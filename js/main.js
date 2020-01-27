const ANALYSIS_SERVER_URL = "116.202.49.178" + "/datastream";

class Frontend {
    setStatus(msg) {
        document.getElementById("status").innerHTML = msg;
    }

    setStreamStatus(msg) {
        document.getElementById("streamstatus").innerHTML = msg;
    }
}

class Datastructure {
    constructor(app) {
        this.app = app;
        this.nodes = new Set();
        this.nodesOnline = new Set();
        this.nodesOffline = new Set();
        this.nodesDisconnected = new Set();
        this.connections = new Set();
    }

    getStatusText() {
        return "nodes online: " + this.nodesOnline.size + "(" + this.nodesDisconnected.size + ")" + " - IDs: " + this.nodes.size + " - edges: " + this.connections.size;
    }

    updateStatus() {
        // TODO: calculateDiscNodes();
        this.app.frontend.setStatus(this.getStatusText());
    }

    addNode(idA) {
        if(!this.nodes.has(idA)) {
            this.nodes.add(idA);

            if(this.app.rendered === 1) {
                this.app.frontend.setStreamStatus("addedToNodepool: " + idA);
                this.updateStatus();
            }
        }
    }

    setNodeOnline(idA) {
        if(this.nodes.has(idA)) {
            // check if in nodesOnline set
            if(!this.nodesOnline.has(idA)) {
                this.nodesOnline.add(idA);
                // TODO: add to graph
                // graph.addNode(idA);

                if(this.app.rendered) {
                    this.frontend.setStreamStatus("setNodeOnline: " + idA)
                    this.updateStatus();
                }
            } else {
                if(this.app.rendered) {
                    this.frontend.setStreamStatus("setNodeOnline skipped: " + idA)
                }
            }

            // check if in nodesOffline set
            if(!this.nodesOffline.has(idA)) {
                this.nodesOffline.delete(idA);

                if(this.app.rendered) {
                    this.frontend.setStreamStatus("removedFromOfflinepool: " + idA)
                    this.updateStatus();
                }
            }

        } else {
            console.error("setNodeOnline but not in nodes list:", idA);
        }
    }
}

class Application {
    constructor(url) {
        this.url = url;
        this.frontend = new Frontend();
        this.ds = new Datastructure(this);

        this.rendered = false; // is the application already rendered?
        this.floodNew = 0;
        this.floodOld = 0;

    }

    run() {
        let initialFloodTimerFunc = () => {
            if (this.floodNew > this.floodOld + 100) {
                this.frontend.setStreamStatus("... received " + this.floodNew + " msg");
                this.floodOld = this.floodNew;
            } else {
                clearInterval(this.initialFloodTimer);
                this.rendered = true;

                // kickoff rendering
                // TODO: call renderer
                
                this.frontend.setStreamStatus("... received " + this.floodNew + " msg");
                this.ds.updateStatus();
                
                // TODO: display nodes online and search field

                // TODO: highlight node passed in url
            }
        }

        this.initialFloodTimer = setInterval(initialFloodTimerFunc, 500);

        this.initWebsocket();
    }

    initWebsocket() {
        this.socket = new WebSocket(
            ((window.location.protocol === "https:") ? "wss://" : "ws://") + this.url
        );
    
        this.socket.onopen = () => {
            this.frontend.setStatus("WebSocket opened. Loading ... ");
            setInterval(() => {
                this.socket.send("_");
            }, 1000);
        };
    
        this.socket.onerror = (e) => {
            this.frontend.setStatus("WebSocket error observed. Please reload.");
            console.error("WebSocket error observed", e);
          };
    
        this.socket.onmessage = (e) => {
            
            if(!this.rendered) { this.floodNew++; }

            switch (e.data[0]) {
                case "_":
                    //do nothing - its just a ping
                    break;
    
                case "A":
                    console.log("addNode:", e.data.substr(1));
                    // filter out empty ids
                    if(e.data.length == 65) {
                        this.ds.addNode(e.data.substr(1));
                    }
                    break;

                // case "a":
                //     console.log("removeNode:", e.data.substr(1));
                //     removeNode(e.data.substr(1));
                //     break;
    
                // case "C":
                //     console.log("connectNodes:", e.data.substr(1, 64), " - ", e.data.substr(65, 128));
                //     connectNodes(e.data.substr(1, 64), e.data.substr(65, 128));
                //     break;
    
                // case "c":
                //     console.log("disconnectNodes:",e.data.substr(1, 64), " - ", e.data.substr(65, 128));
                //     disconnectNodes(e.data.substr(1, 64), e.data.substr(65, 128));
                //     break;
    
                case "O":
                    console.log("setNodeOnline:",e.data.substr(1));
                    this.ds.setNodeOnline(e.data.substr(1));
                    break;
    
                // case "o":
                //     console.log("setNodeOffline:",e.data.substr(1));
                //     setNodeOffline(e.data.substr(1));
                //     break;
            }
        }
    }
}



window.onload = () => {
    new Application(ANALYSIS_SERVER_URL).run();
}