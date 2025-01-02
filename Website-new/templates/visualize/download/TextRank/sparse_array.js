/**
 * Converts a graph to a SciPy-like sparse array.
 * 
 * @param {Object} G - The graph object with edges and optional weights.
 * @param {Array} [nodelist=null] - Ordered list of nodes; uses G.nodes() if null.
 * @param {String} [dtype=null] - The data type for the sparse matrix.
 * @param {String} [weight="weight"] - The edge attribute to use for weights.
 * @param {String} [format="csr"] - The sparse matrix format ("csr", "coo", etc.).
 * @returns {Object} - A sparse matrix representation of the graph.
 */
function toScipySparseArray(G, nodelist = null, dtype = null, weight = "weight", format = "csr") {
    if (!G || Object.keys(G).length === 0) {
        throw new Error("Graph has no nodes or edges");
    }

    // Determine nodelist and subgraph
    let nodes = nodelist || Object.keys(G.nodes);
    let nlen = nodes.length;

    if (nlen === 0) {
        throw new Error("nodelist has no nodes");
    }

    let nodeset = new Set(nodes);
    if (nodeset.size !== nlen) {
        throw new Error("nodelist contains duplicates");
    }

    if (nodeset.size < Object.keys(G.nodes).length) {
        // Create a subgraph from the provided nodelist
        G = G.subgraph(nodes);
    }

    // Map node to index
    let index = Object.fromEntries(nodes.map((node, i) => [node, i]));

    // Extract coefficients
    let row = [];
    let col = [];
    let data = [];

    G.edges.forEach(([u, v, wt]) => {
        let r = index[u];
        let c = index[v];
        let d = wt !== undefined ? wt : 1;

        if (r !== undefined && c !== undefined) {
            row.push(r);
            col.push(c);
            data.push(d);
        }
    });

    if (!G.isDirected) {
        // Symmetrize matrix for undirected graphs
        let symRow = row.concat(col);
        let symCol = col.concat(row);
        let symData = data.concat(data);

        // Adjust self-loops
        G.selfLoops.forEach(([u, wt]) => {
            let idx = index[u];
            if (idx !== undefined) {
                symData.push(-wt);
                symRow.push(idx);
                symCol.push(idx);
            }
        });

        row = symRow;
        col = symCol;
        data = symData;
    }

    // Create sparse matrix object
    let sparseMatrix = {
        format: format,
        data: data,
        row: row,
        col: col,
        shape: [nlen, nlen],
        dtype: dtype,
    };

    return sparseMatrix;
}
