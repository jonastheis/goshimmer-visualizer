const ANALYSIS_SERVER_URL = "116.202.49.178" + "/datastream";

class Frontend {
    setStatusMessage(msg) {
        document.getElementById("status").innerHTML = msg;
    }

    setStreamStatusMessage(msg) {
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

    addNode(idA) {
        if(!this.nodes.has(idA)) {
            this.nodes.add(idA);

            this.app.setStreamStatusMessage("addedToNodepool: " + idA);
            this.app.updateStatus();
        }
    }

    removeNode() {
        if(this.nodesOnline.has(idA)) {
            this.nodesOnline.delete(idA);
            // TODO: graph.removeNode(idA);

            this.app.setStreamStatusMessage("removeNode from onlinepool: " + idA);
        }
        
        if(this.nodesOffline.has(idA)) {
            this.nodesOffline.delete(idA);
            this.app.setStreamStatusMessage("removeNode from offlinepool: " + idA);
        }

        if(this.nodes.has(idA)) {
            this.nodes.delete(idA);
            this.app.setStreamStatusMessage("removeNode from nodepool: " + idA);
        }
        
        this.app.updateStatus();
    }

    setNodeOnline(idA) {
        if(!this.nodes.has(idA)) {
            console.error("setNodeOnline but not in nodes list:", idA);
            return;
        }

        // check if not in nodesOnline set
        if(!this.nodesOnline.has(idA)) {
            this.nodesOnline.add(idA);
            // TODO: add to graph
            // graph.addNode(idA);

            this.app.setStreamStatusMessage("setNodeOnline: " + idA)
        } else {
            this.app.setStreamStatusMessage("setNodeOnline skipped: " + idA)
        }

        // check if in nodesOffline set
        if(this.nodesOffline.has(idA)) {
            this.nodesOffline.delete(idA);

            this.app.setStreamStatusMessage("removedFromOfflinepool: " + idA)
        }

        this.app.updateStatus();
    }

    setNodeOffline(idA) {
        if(!this.nodes.has(idA)) {
            console.error("setNodeOffline but not in nodes list:", idA);
            return;
        }

        if(!this.nodesOffline.has(idA)) {
            this.nodesOffline.add(idA);

            this.app.setStreamStatusMessage("addedToOfflinepool: " + idA)
        }

        // check if node is currently online
        if(this.nodesOnline.has(idA)) {
            this.nodesOnline.delete(idA);
            // TODO: remove from graph
            // graph.removeNode(idA);

            this.app.setStreamStatusMessage("removedFromOnlinepool: " + idA)
        }

        this.app.updateStatus();
    }

    connectNodes(idA, idB) {
        
    }

    disconnectNodes(idA, idB) {

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

    setStatusMessage(msg) {
        if(this.rendered) {
            this.frontend.setStatusMessage(msg);
            console.log('%cStatusMessage: ' + msg, 'color: gray');
        }
    }

    setStreamStatusMessage(msg) {
        if(this.rendered) {
            this.frontend.setStreamStatusMessage(msg);
            console.log('%cStreamStatusMessage: ' + msg, 'color: gray');
        }
    }

    updateStatus() {
        // TODO: calculateDiscNodes();
        this.setStatusMessage(this.ds.getStatusText());
    }

    run() {
        let initialFloodTimerFunc = () => {
            if (this.floodNew > this.floodOld + 100) {
                this.setStreamStatusMessage("... received " + this.floodNew + " msg");
                this.floodOld = this.floodNew;
            } else {
                clearInterval(this.initialFloodTimer);
                this.startRendering();
            }
        }

        this.initialFloodTimer = setInterval(initialFloodTimerFunc, 500);
        this.initWebsocket();
    }

    startRendering() {
        // kickoff rendering
        this.rendered = true;

        // TODO: call renderer
        
        this.setStreamStatusMessage("... received " + this.floodNew + " msg");
        this.updateStatus();
        
        // TODO: display nodes online and search field

        // TODO: highlight node passed in url
    }

    initWebsocket() {
        this.socket = new WebSocket(
            ((window.location.protocol === "https:") ? "wss://" : "ws://") + this.url
        );
    
        this.socket.onopen = () => {
            this.setStatusMessage("WebSocket opened. Loading ... ");
            setInterval(() => {
                this.socket.send("_");
            }, 1000);
        };
    
        this.socket.onerror = (e) => {
            this.setStatusMessage("WebSocket error observed. Please reload.");
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

                case "a":
                    console.log("removeNode:", e.data.substr(1));
                    this.ds.removeNode(e.data.substr(1));
                    break;
    
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
    
                case "o":
                    console.log("setNodeOffline:",e.data.substr(1));
                    this.ds.setNodeOffline(e.data.substr(1));
                    break;
            }
        }
    }
}



window.onload = () => {
    new Application(ANALYSIS_SERVER_URL).run();
}