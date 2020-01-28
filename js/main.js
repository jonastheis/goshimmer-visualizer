const ANALYSIS_SERVER_URL = "116.202.49.178" + "/datastream";
const NODE_ID_LENGTH = 64;

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

    connectNodes(con, idA, idB) {
        if(!this.nodes.has(idA)) {
            console.error("connectNodes but not in nodes list:", idA, con);
            return;
        }
        if(!this.nodes.has(idB)) {
            console.error("connectNodes but not in nodes list:", idB, con);
            return;
        }

        if(this.connections.has(con)) {
            this.app.setStreamStatusMessage("connectNodes skipped: " + idA + " > " + idB);
        } else {
            // add new connection only if both nodes are online
            if(this.nodesOnline.has(idA) && this.nodesOnline.has(idB) && idA != idB) {
                // TODO: graph.addLink(idA, idB, con);
                this.connections.add(con);

                // TODO: add additional data structure for fast neighbor lookup
                // neighbors[id] = { in: set(), out: set() }

                this.app.setStreamStatusMessage("connectNodes: " + idA + " > " + idB);
                this.app.updateStatus();
            } else {
                console.log("connectNodes skipped: either node not online", idA, idB);
            }
        }
    }

    disconnectNodes(con, idA, idB) {
        if(!this.nodes.has(idA)) {
            console.error("disconnectNodes but not in nodes list:", idA, con);
            return;
        }
        if(!this.nodes.has(idB)) {
            console.error("disconnectNodes but not in nodes list:", idB, con);
            return;
        }

        if(this.connections.has(con)) {
            // TODO: remove connection in graph
            // let conn = graph.getLink(idA, idB);
            // graph.removeLink(conn);

            this.app.setStreamStatusMessage("disconnectNodes: " + idA + " > " + idB);
            this.app.updateStatus();
        } else {
            console.log("disconnectNodes skipped: either node not online", idA, idB);
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
            let type = e.data[0];
            let data = e.data.substr(1);
            let idA = data.substr(0, NODE_ID_LENGTH);
            let idB;
            
            if(!this.rendered) { this.floodNew++; }

            switch (type) {
                case "_":
                    //do nothing - its just a ping
                    break;
    
                case "A":
                    console.log("addNode event:", idA);
                    // filter out empty ids
                    if(idA.length == NODE_ID_LENGTH) {
                        this.ds.addNode(idA);
                    }
                    break;

                case "a":
                    console.log("removeNode event:", idA);
                    this.ds.removeNode(idA);
                    break;
    
                case "C":
                    idB = data.substr(NODE_ID_LENGTH, NODE_ID_LENGTH);
                    console.log("connectNodes event:", idA, " - ", idB);
                    this.ds.connectNodes(idA+idB, idA, idB);
                    break;
    
                case "c":
                    idB = data.substr(NODE_ID_LENGTH, NODE_ID_LENGTH);
                    console.log("disconnectNodes event:", idA, " - ", idB);
                    this.ds.disconnectNodes(idA+idB, idA, idB);
                    break;
    
                case "O":
                    console.log("setNodeOnline event:", idA);
                    this.ds.setNodeOnline(idA);
                    break;
    
                case "o":
                    console.log("setNodeOffline event:", idA);
                    this.ds.setNodeOffline(idA);
                    break;
            }
        }
    }
}



window.onload = () => {
    new Application(ANALYSIS_SERVER_URL).run();
}