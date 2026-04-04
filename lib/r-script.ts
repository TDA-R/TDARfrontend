
export function parseMapperJson(parsedData: any): any {
    if (!parsedData || typeof parsedData !== 'object') {
        throw new Error("Invalid parsed data");
    }

    const numVertices = parsedData.num_vertices;
    const nodes: any[] = [];
    const originalData = parsedData.original_data;

    const getSpecies = (indices: number[]) => {
        if (!indices || indices.length === 0) return "unknown";

        const speciesCounts: Record<string, number> = {};
        indices.forEach(idx => {
            let species = "unknown";
            if (Array.isArray(originalData)) {
                const row = originalData[idx - 1];
                if (row) species = row.Species || row.label || "unknown";
            } else if (originalData && originalData.Species) {
                species = originalData.Species[idx - 1];
            } else if (originalData && originalData.label) {
                species = originalData.label[idx - 1];
            }

            speciesCounts[species] = (speciesCounts[species] || 0) + 1;
        });

        if (Object.keys(speciesCounts).length === 0) return "unknown";
        return Object.entries(speciesCounts).reduce((a, b) => a[1] > b[1] ? a : b)[0];
    };

    for (let i = 0; i < numVertices; i++) {
        const rawIndices = parsedData.points_in_vertex[i];
        const indices = Array.isArray(rawIndices) ? rawIndices : [rawIndices];

        const level = parsedData.level_of_vertex[i];
        const size = indices.length;
        const id = `node_${i + 1}`;
        const species = getSpecies(indices);

        nodes.push({
            id: id,
            group: level,
            val: size,
            name: id,
            desc: `Cluster ${id} (Size: ${size}, Species: ${species})`,
            species: species,
            indices: indices
        });
    }

    const links: any[] = [];
    const adjacency = parsedData.adjacency;

    if (Array.isArray(adjacency)) {
        for (let i = 0; i < numVertices; i++) {
            for (let j = i + 1; j < numVertices; j++) {
                if (adjacency[i] && adjacency[i][j] === 1) {
                    const indicesA = nodes[i].indices || [];
                    const indicesB = nodes[j].indices || [];
                    const setA = new Set(indicesA);
                    const intersectionCount = indicesB.filter((idx: any) => setA.has(idx)).length;

                    links.push({
                        source: nodes[i].id,
                        target: nodes[j].id,
                        value: intersectionCount || 1
                    });
                }
            }
        }
    }

    const reverseLinks = links.map(link => ({
        source: link.target,
        target: link.source,
        value: link.value,
        isReverse: true
    }));

    return {
        nodes,
        links: [...links, ...reverseLinks],
        originalData: parsedData.original_data,
        rawNodes: nodes,
        adjacency: parsedData.adjacency,
        cc: parsedData.cc
    };
}
