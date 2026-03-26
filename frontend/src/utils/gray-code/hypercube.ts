/**
 * Hypercube graph utilities for Gray code visualization
 */

export interface HypercubeVertex {
  code: string;
  index: number;
  position: { x: number; y: number; z?: number };
}

export interface HypercubeEdge {
  from: string;
  to: string;
  bitPosition: number;
}

/**
 * Generate hypercube vertices for given bit width
 * @param bitWidth - Number of bits
 * @returns Array of vertices
 */
export function generateHypercubeVertices(bitWidth: number): HypercubeVertex[] {
  const count = Math.pow(2, bitWidth);
  const vertices: HypercubeVertex[] = [];

  for (let i = 0; i < count; i++) {
    const code = (i ^ (i >> 1)).toString(2).padStart(bitWidth, '0');
    const position = calculateVertexPosition(i, bitWidth);

    vertices.push({
      code,
      index: i,
      position,
    });
  }

  return vertices;
}

/**
 * Generate hypercube edges
 * @param bitWidth - Number of bits
 * @returns Array of edges
 */
export function generateHypercubeEdges(bitWidth: number): HypercubeEdge[] {
  const count = Math.pow(2, bitWidth);
  const edges: HypercubeEdge[] = [];

  for (let i = 0; i < count; i++) {
    const codeI = (i ^ (i >> 1)).toString(2).padStart(bitWidth, '0');

    // Connect to neighbors (Hamming distance 1)
    for (let j = i + 1; j < count; j++) {
      const codeJ = (j ^ (j >> 1)).toString(2).padStart(bitWidth, '0');
      const xor = i ^ j;

      // Check if exactly one bit differs (power of 2)
      if ((xor & (xor - 1)) === 0) {
        const bitPosition = Math.log2(xor);
        edges.push({
          from: codeI,
          to: codeJ,
          bitPosition,
        });
      }
    }
  }

  return edges;
}

/**
 * Calculate 2D/3D position for hypercube vertex
 * Uses different layouts based on bit width
 */
function calculateVertexPosition(
  index: number,
  bitWidth: number
): { x: number; y: number; z?: number } {
  const centerX = 400;
  const centerY = 300;

  if (bitWidth === 2) {
    // Square layout
    const size = 200;
    return {
      x: centerX + (index % 2 ? size : -size),
      y: centerY + (index >= 2 ? size : -size),
    };
  }

  if (bitWidth === 3) {
    // Cube layout (3D or 2D projection)
    const size = 150;
    const x = (index % 2) * 2 - 1;
    const y = ((index >> 1) % 2) * 2 - 1;
    const z = ((index >> 2) % 2) * 2 - 1;

    return {
      x: centerX + size * (x + z * 0.5),
      y: centerY + size * (y - z * 0.5),
      z: z * size,
    };
  }

  // Circular layout for 4+ bits
  const count = Math.pow(2, bitWidth);
  const radius = 250;
  const angle = (2 * Math.PI * index) / count - Math.PI / 2;

  return {
    x: centerX + radius * Math.cos(angle),
    y: centerY + radius * Math.sin(angle),
  };
}

/**
 * Find shortest path in hypercube between two Gray codes
 * Uses BFS to guarantee minimum path length
 * @param from - Source Gray code
 * @param to - Target Gray code
 * @param bitWidth - Number of bits
 * @returns Array of Gray codes forming the path
 */
export function findShortestPath(from: string, to: string, bitWidth: number): string[] {
  const fromInt = parseInt(from, 2) ^ (parseInt(from, 2) >> 1);
  const toInt = parseInt(to, 2) ^ (parseInt(to, 2) >> 1);

  // BFS
  const queue: Array<{ node: number; path: number[] }> = [{ node: fromInt, path: [fromInt] }];
  const visited = new Set<number>([fromInt]);

  while (queue.length > 0) {
    const { node, path } = queue.shift()!;

    if (node === toInt) {
      // Convert path to Gray codes
      return path.map((n) => {
        const gray = n ^ (n >> 1);
        return gray.toString(2).padStart(bitWidth, '0');
      });
    }

    // Explore neighbors (flip each bit)
    for (let bit = 0; bit < bitWidth; bit++) {
      const neighbor = node ^ (1 << bit);

      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push({
          node: neighbor,
          path: [...path, neighbor],
        });
      }
    }
  }

  return []; // No path found (shouldn't happen in hypercube)
}
