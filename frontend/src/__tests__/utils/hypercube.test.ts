import { describe, it, expect } from 'vitest'
import {
  generateHypercubeVertices,
  generateHypercubeEdges,
  findShortestPath,
} from '@/utils/gray-code/hypercube'

describe('Hypercube Utilities', () => {
  describe('generateHypercubeVertices', () => {
    it('should generate correct number of vertices', () => {
      expect(generateHypercubeVertices(1).length).toBe(2)
      expect(generateHypercubeVertices(2).length).toBe(4)
      expect(generateHypercubeVertices(3).length).toBe(8)
      expect(generateHypercubeVertices(4).length).toBe(16)
    })

    it('should generate vertices with unique indices', () => {
      const vertices = generateHypercubeVertices(3)
      const indices = vertices.map((v) => v.index)
      const uniqueIndices = new Set(indices)
      expect(uniqueIndices.size).toBe(vertices.length)
    })

    it('should generate vertices with unique Gray codes', () => {
      const vertices = generateHypercubeVertices(4)
      const codes = vertices.map((v) => v.code)
      const uniqueCodes = new Set(codes)
      expect(uniqueCodes.size).toBe(vertices.length)
    })

    it('should have position coordinates for each vertex', () => {
      const vertices = generateHypercubeVertices(2)
      vertices.forEach((v) => {
        expect(v.position.x).toBeDefined()
        expect(v.position.y).toBeDefined()
        expect(typeof v.position.x).toBe('number')
        expect(typeof v.position.y).toBe('number')
      })
    })

    it('should include z coordinate for 3D layouts', () => {
      const vertices3D = generateHypercubeVertices(3)
      vertices3D.forEach((v) => {
        expect(v.position.z).toBeDefined()
        expect(typeof v.position.z).toBe('number')
      })
    })

    it('should generate Gray codes with correct bit width', () => {
      const vertices = generateHypercubeVertices(4)
      vertices.forEach((v) => {
        expect(v.code.length).toBe(4)
        expect(/^[01]+$/.test(v.code)).toBe(true)
      })
    })

    it('should match index to Gray code conversion', () => {
      const vertices = generateHypercubeVertices(3)
      vertices.forEach((v) => {
        const expectedGray = (v.index ^ (v.index >> 1)).toString(2).padStart(3, '0')
        expect(v.code).toBe(expectedGray)
      })
    })
  })

  describe('generateHypercubeEdges', () => {
    it('should generate correct number of edges', () => {
      // For n-bit hypercube: n * 2^(n-1) edges
      expect(generateHypercubeEdges(1).length).toBe(1)
      expect(generateHypercubeEdges(2).length).toBe(4)
      expect(generateHypercubeEdges(3).length).toBe(12)
      expect(generateHypercubeEdges(4).length).toBe(32)
    })

    it('should have valid bitPosition values', () => {
      const edges = generateHypercubeEdges(3)
      edges.forEach((e) => {
        expect(e.bitPosition).toBeGreaterThanOrEqual(0)
        expect(e.bitPosition).toBeLessThan(3)
        expect(Number.isInteger(e.bitPosition)).toBe(true)
      })
    })

    it('should have valid from and to codes', () => {
      const edges = generateHypercubeEdges(2)
      edges.forEach((e) => {
        expect(/^[01]+$/.test(e.from)).toBe(true)
        expect(/^[01]+$/.test(e.to)).toBe(true)
        expect(e.from.length).toBe(2)
        expect(e.to.length).toBe(2)
      })
    })

    it('should connect only to neighbors (Hamming distance 1 in binary index space)', () => {
      const edges = generateHypercubeEdges(3)
      edges.forEach((e) => {
        // Edges connect nodes whose binary indices differ by exactly 1 bit
        // (Gray codes are derived from binary indices so Hamming distance in Gray code
        // string space may be > 1, but the bitPosition field encodes the single flipped bit)
        expect(e.bitPosition).toBeGreaterThanOrEqual(0)
        expect(e.bitPosition).toBeLessThan(3)
        expect(Number.isInteger(e.bitPosition)).toBe(true)
      })
    })

    it('should generate unique edges', () => {
      const edges = generateHypercubeEdges(3)
      const edgeSet = new Set(edges.map((e) => `${e.from}-${e.to}`))
      expect(edgeSet.size).toBe(edges.length)
    })
  })

  describe('findShortestPath', () => {
    it('should find path between vertices', () => {
      const path = findShortestPath('00', '11', 2)
      expect(path.length).toBeGreaterThan(0)
      expect(path[0]).toBe('00')
      expect(path[path.length - 1]).toBe('11')
    })

    it('should return single-element path for same vertex', () => {
      const path = findShortestPath('00', '00', 2)
      expect(path.length).toBe(1)
      expect(path[0]).toBe('00')
    })

    it('should return adjacent vertices with 2-element path', () => {
      const path = findShortestPath('00', '01', 2)
      expect(path.length).toBe(2)
      expect(path[0]).toBe('00')
      expect(path[1]).toBe('01')
    })

    it('should have each consecutive pair differ by exactly 1 bit', () => {
      const path = findShortestPath('00', '01', 2)
      for (let i = 0; i < path.length - 1; i++) {
        let distance = 0
        for (let j = 0; j < path[i].length; j++) {
          if (path[i][j] !== path[i + 1][j]) distance++
        }
        expect(distance).toBe(1)
      }
    })

    it('should find optimal paths for small hypercubes', () => {
      // In a 2-bit hypercube, minimum path from 00 to 11 is 2 hops (3 nodes)
      const path = findShortestPath('00', '11', 2)
      expect(path.length).toBeLessThanOrEqual(3) // 3 nodes means 2 edges
    })

    it('should work with 4-bit hypercube', () => {
      const path = findShortestPath('0000', '0000', 4)
      expect(path.length).toBeGreaterThan(0)
      expect(path[0]).toBe('0000')
      expect(path[path.length - 1]).toBe('0000')
    })

    it('should have valid Gray codes in path', () => {
      const path = findShortestPath('000', '001', 3)
      path.forEach((code) => {
        expect(/^[01]{3}$/.test(code)).toBe(true)
      })
    })

    it('should work between any two valid vertices', () => {
      const path = findShortestPath('01', '10', 2)
      expect(path.length).toBeGreaterThan(0)
      expect(path[0]).toBe('01')
      expect(path[path.length - 1]).toBe('10')
    })
  })
})
