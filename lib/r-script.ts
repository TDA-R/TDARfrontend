
export class MapperFormatError extends Error {
    errors: string[];
    missingFields: string[];

    constructor(message: string, errors: string[] = [], missingFields: string[] = []) {
        super(message);
        this.name = 'MapperFormatError';
        this.errors = errors.length > 0 ? errors : [message];
        this.missingFields = missingFields;
    }
}

export interface MapperValidationResult {
    valid: boolean;
    errors: string[];
    missingFields: string[];
}

export function validateMapperJson(parsedData: any): MapperValidationResult {
    const errors: string[] = [];
    const missingFields: string[] = [];

    if (!parsedData || typeof parsedData !== 'object' || Array.isArray(parsedData)) {
        return {
            valid: false,
            errors: ['The root structure of the JSON file must be an object ({ ... }), not an array or empty value.'],
            missingFields: ['num_vertices', 'points_in_vertex', 'level_of_vertex', 'adjacency']
        };
    }

    // 1. num_vertices
    if (parsedData.num_vertices === undefined || parsedData.num_vertices === null) {
        missingFields.push('num_vertices');
        errors.push("Missing required field 'num_vertices' (total number of nodes, must be a positive integer).");
    } else if (typeof parsedData.num_vertices !== 'number' || isNaN(parsedData.num_vertices) || parsedData.num_vertices <= 0) {
        errors.push(`'num_vertices' must be an integer greater than 0 (received: ${JSON.stringify(parsedData.num_vertices)}).`);
    }

    // 2. points_in_vertex
    if (parsedData.points_in_vertex === undefined || parsedData.points_in_vertex === null) {
        missingFields.push('points_in_vertex');
        errors.push("Missing required field 'points_in_vertex' (list of sample indices for each node).");
    } else if (!Array.isArray(parsedData.points_in_vertex) && typeof parsedData.points_in_vertex !== 'object') {
        errors.push("'points_in_vertex' must be an array or list.");
    }

    // 3. level_of_vertex
    if (parsedData.level_of_vertex === undefined || parsedData.level_of_vertex === null) {
        missingFields.push('level_of_vertex');
        errors.push("Missing required field 'level_of_vertex' (filter function level for each node).");
    } else if (!Array.isArray(parsedData.level_of_vertex) && typeof parsedData.level_of_vertex !== 'object') {
        errors.push("'level_of_vertex' must be an array.");
    }

    // 4. adjacency
    if (parsedData.adjacency === undefined || parsedData.adjacency === null) {
        missingFields.push('adjacency');
        errors.push("Missing required field 'adjacency' (node adjacency matrix).");
    } else if (!Array.isArray(parsedData.adjacency)) {
        errors.push("'adjacency' must be a 2D matrix array (2D Array).");
    } else if (parsedData.adjacency.length > 0 && !Array.isArray(parsedData.adjacency[0])) {
        errors.push("'adjacency' elements must be 2D row arrays (e.g., [[0, 1], [1, 0]]).");
    }

    return {
        valid: errors.length === 0,
        errors,
        missingFields
    };
}

export interface MapperWarning {
    field: string;
    title: string;
    impacts: string[];
}

export function checkMapperWarnings(parsedData: any): MapperWarning[] {
    const warnings: MapperWarning[] = [];

    // Check original_data
    if (!parsedData.original_data) {
        warnings.push({
            field: 'original_data',
            title: "'original_data' is not provided",
            impacts: [
                "Dynamic Node Coloring ('Color by' dropdown): Variable-based color palettes cannot be used.",
                "Node Inspector (Node EDA & Barplots): Clicking a node will not display sample distributions or histograms.",
                "Label Distribution: Categorical label breakdown in the analytics panel will not be generated.",
                "Export Feature Data: 'Download Original Data CSV' will be disabled."
            ]
        });
    }

    // Check input_params
    if (!parsedData.input_params) {
        warnings.push({
            field: 'input_params',
            title: "'input_params' is not provided",
            impacts: [
                "Algorithm Parameter Inspection: Mapper parameters (intervals, overlap %, clustering method, distance metric) will not be displayed.",
                "Reproducibility Metadata: Model filter specifications cannot be inspected."
            ]
        });
    }

    return warnings;
}

export function parseMapperJson(parsedData: any): any {
    const validation = validateMapperJson(parsedData);
    if (!validation.valid) {
        throw new MapperFormatError("JSON format does not match TDA-R Mapper specifications", validation.errors, validation.missingFields);
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
        inputParams: parsedData.input_params,
        rawNodes: nodes,
        adjacency: parsedData.adjacency,
        cc: parsedData.cc
    };
}
