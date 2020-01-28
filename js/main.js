const ANALYSIS_SERVER_URL = "116.202.49.178" + "/datastream";
const NODE_ID_LENGTH = 64;

const EDGE_COLOR_DEFAULT = "#444444";
const VERTEX_COLOR_DEFAULT = "0x666666";
const VERTEX_SIZE = 14;

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

    removeNode(idA) {
        if(this.nodesOnline.has(idA)) {
            this.nodesOnline.delete(idA);
            this.app.graph.deleteNode(idA);

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
            this.app.graph.addVertex(idA);

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
            this.app.graph.deleteVertex(idA);

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
                this.app.graph.addEdge(con, idA, idB);
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
            this.connections.delete(con);
            this.app.graph.deleteEdge(con, idA, idB);

            this.app.setStreamStatusMessage("disconnectNodes: " + idA + " > " + idB);
            this.app.updateStatus();
        } else {
            console.log("disconnectNodes skipped: either node not online", idA, idB);
        }
    }
}

class Graph {
    constructor() {
        this.graph = Viva.Graph.graph();
        this.graphics = Viva.Graph.View.webglGraphics();
        this.calculator = Viva.Graph.centrality();

        this.layout = Viva.Graph.Layout.forceDirected(this.graph, {
            springLength: 30,
            springCoeff: 0.0001,
            dragCoeff: 0.02,
            gravity: -1.2
        });

        this.graphics.link((link) => {
            return Viva.Graph.View.webglLine(EDGE_COLOR_DEFAULT);
        });

        this.graphics.setNodeProgram(buildCircleNodeShader());

        this.graphics.node((node) => {
            return new WebGLCircle(VERTEX_SIZE, VERTEX_COLOR_DEFAULT);
        });

        this.renderer = Viva.Graph.View.renderer(this.graph, {
            layout: this.layout,
            graphics: this.graphics,
            container: document.getElementById('graphc'),
            renderLinks: true
        });
    }

    addEdge(con, idA, idB) {
        this.graph.addLink(idA, idB, con);
    }

    deleteEdge(con, idA, idB) {
        // TODO: verify let conn = graph.getLink(idA, idB);
        this.graph.removeLink(con);
    }

    addVertex(idA) {
        this.graph.addNode(idA);
    }

    deleteVertex(idA) {
        this.graph.removeNode(idA);
    }

    render() {
        this.renderer.run();
    }
}

class Application {
    constructor(url) {
        this.url = url;
        this.frontend = new Frontend();
        this.ds = new Datastructure(this);
        this.graph = new Graph();

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

        this.graph.render();
        
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






/**
 * WebGL stuff 
 */

function WebGLCircle(size, color) {
    this.size = size;
    this.color = color;
}
// Next comes the hard part - implementation of API for custom shader
// program, used by webgl renderer:
function buildCircleNodeShader() {
    // For each primitive we need 4 attributes: x, y, color and size.
    var ATTRIBUTES_PER_PRIMITIVE = 4,
        nodesFS = [
            'precision mediump float;',
            'varying vec4 color;',
            'void main(void) {',
            '   if ((gl_PointCoord.x - 0.5) * (gl_PointCoord.x - 0.5) + (gl_PointCoord.y - 0.5) * (gl_PointCoord.y - 0.5) < 0.25) {',
            '     gl_FragColor = color;',
            '   } else {',
            '     gl_FragColor = vec4(0);',
            '   }',
            '}'].join('\n'),
        nodesVS = [
            'attribute vec2 a_vertexPos;',
            // Pack color and size into vector. First elemnt is color, second - size.
            // Since it's floating point we can only use 24 bit to pack colors...
            // thus alpha channel is dropped, and is always assumed to be 1.
            'attribute vec2 a_customAttributes;',
            'uniform vec2 u_screenSize;',
            'uniform mat4 u_transform;',
            'varying vec4 color;',
            'void main(void) {',
            '   gl_Position = u_transform * vec4(a_vertexPos/u_screenSize, 0, 1);',
            '   gl_PointSize = a_customAttributes[1] * u_transform[0][0];',
            '   float c = a_customAttributes[0];',
            '   color.b = mod(c, 256.0); c = floor(c/256.0);',
            '   color.g = mod(c, 256.0); c = floor(c/256.0);',
            '   color.r = mod(c, 256.0); c = floor(c/256.0); color /= 255.0;',
            '   color.a = 1.0;',
            '}'].join('\n');
    var program,
        gl,
        buffer,
        locations,
        utils,
        nodes = new Float32Array(64),
        nodesCount = 0,
        canvasWidth, canvasHeight, transform,
        isCanvasDirty;
    return {
        /**
         * Called by webgl renderer to load the shader into gl context.
         */
        load: function (glContext) {
            gl = glContext;
            webglUtils = Viva.Graph.webgl(glContext);
            program = webglUtils.createProgram(nodesVS, nodesFS);
            gl.useProgram(program);
            locations = webglUtils.getLocations(program, ['a_vertexPos', 'a_customAttributes', 'u_screenSize', 'u_transform']);
            gl.enableVertexAttribArray(locations.vertexPos);
            gl.enableVertexAttribArray(locations.customAttributes);
            buffer = gl.createBuffer();
        },
        /**
         * Called by webgl renderer to update node position in the buffer array
         *
         * @param nodeUI - data model for the rendered node (WebGLCircle in this case)
         * @param pos - {x, y} coordinates of the node.
         */
        position: function (nodeUI, pos) {
            var idx = nodeUI.id;
            nodes[idx * ATTRIBUTES_PER_PRIMITIVE] = pos.x;
            nodes[idx * ATTRIBUTES_PER_PRIMITIVE + 1] = -pos.y;
            nodes[idx * ATTRIBUTES_PER_PRIMITIVE + 2] = nodeUI.color;
            nodes[idx * ATTRIBUTES_PER_PRIMITIVE + 3] = nodeUI.size;
        },
        /**
         * Request from webgl renderer to actually draw our stuff into the
         * gl context. This is the core of our shader.
         */
        render: function () {
            gl.useProgram(program);
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
            gl.bufferData(gl.ARRAY_BUFFER, nodes, gl.DYNAMIC_DRAW);
            if (isCanvasDirty) {
                isCanvasDirty = false;
                gl.uniformMatrix4fv(locations.transform, false, transform);
                gl.uniform2f(locations.screenSize, canvasWidth, canvasHeight);
            }
            gl.vertexAttribPointer(locations.vertexPos, 2, gl.FLOAT, false, ATTRIBUTES_PER_PRIMITIVE * Float32Array.BYTES_PER_ELEMENT, 0);
            gl.vertexAttribPointer(locations.customAttributes, 2, gl.FLOAT, false, ATTRIBUTES_PER_PRIMITIVE * Float32Array.BYTES_PER_ELEMENT, 2 * 4);
            gl.drawArrays(gl.POINTS, 0, nodesCount);
        },
        /**
         * Called by webgl renderer when user scales/pans the canvas with nodes.
         */
        updateTransform: function (newTransform) {
            transform = newTransform;
            isCanvasDirty = true;
        },
        /**
         * Called by webgl renderer when user resizes the canvas with nodes.
         */
        updateSize: function (newCanvasWidth, newCanvasHeight) {
            canvasWidth = newCanvasWidth;
            canvasHeight = newCanvasHeight;
            isCanvasDirty = true;
        },
        /**
         * Called by webgl renderer to notify us that the new node was created in the graph
         */
        createNode: function (node) {
            nodes = webglUtils.extendArray(nodes, nodesCount, ATTRIBUTES_PER_PRIMITIVE);
            nodesCount += 1;
        },
        /**
         * Called by webgl renderer to notify us that the node was removed from the graph
         */
        removeNode: function (node) {
            if (nodesCount > 0) { nodesCount -= 1; }
            if (node.id < nodesCount && nodesCount > 0) {
                // we do not really delete anything from the buffer.
                // Instead we swap deleted node with the "last" node in the
                // buffer and decrease marker of the "last" node. Gives nice O(1)
                // performance, but make code slightly harder than it could be:
                webglUtils.copyArrayPart(nodes, node.id * ATTRIBUTES_PER_PRIMITIVE, nodesCount * ATTRIBUTES_PER_PRIMITIVE, ATTRIBUTES_PER_PRIMITIVE);
            }
        },
        /**
         * This method is called by webgl renderer when it changes parts of its
         * buffers. We don't use it here, but it's needed by API (see the comment
         * in the removeNode() method)
         */
        replaceProperties: function (replacedNode, newNode) { },
    };
}
