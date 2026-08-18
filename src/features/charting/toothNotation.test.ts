import { describe, expect, it } from 'vitest'
import {
  allTeeth,
  cellsForArch,
  fdiForPosition,
  isValidFdi,
  mesialOnRight,
  parseFdi,
  positionKey,
  segmentMap,
  surfacesFor,
  toothName,
  toothType,
  toPalmer,
  toUniversal,
  type ArchCell,
} from './toothNotation'

/**
 * The mirroring and surface-derivation rules are the two places a wrong answer would be silent —
 * a mirrored chart still renders, and an over-broad surface list still saves. Both are pinned here.
 */

const fdis = (cells: ArchCell[]) =>
  cells.filter((c) => c.kind === 'tooth').map((c) => (c as { fdi: string }).fdi)

describe('isValidFdi', () => {
  it('accepts real teeth in every quadrant', () => {
    for (const fdi of ['11', '18', '21', '28', '31', '38', '41', '48']) {
      expect(isValidFdi(fdi)).toBe(true)
    }
    for (const fdi of ['51', '55', '65', '75', '85']) expect(isValidFdi(fdi)).toBe(true)
  })

  it('rejects positions that do not exist', () => {
    // Primary quadrants stop at position 5 — there is no primary second premolar.
    expect(isValidFdi('56')).toBe(false)
    expect(isValidFdi('88')).toBe(false)
    expect(isValidFdi('19')).toBe(false)
    expect(isValidFdi('10')).toBe(false)
    expect(isValidFdi('91')).toBe(false)
    expect(isValidFdi('1')).toBe(false)
    expect(isValidFdi('111')).toBe(false)
  })

  it('throws rather than guessing when parsing something invalid', () => {
    expect(() => parseFdi('56')).toThrow()
  })
})

describe('parseFdi', () => {
  it('maps quadrants to the arch and the patient side', () => {
    expect(parseFdi('11')).toMatchObject({ arch: 'upper', side: 'right', dentition: 'permanent' })
    expect(parseFdi('21')).toMatchObject({ arch: 'upper', side: 'left', dentition: 'permanent' })
    expect(parseFdi('31')).toMatchObject({ arch: 'lower', side: 'left', dentition: 'permanent' })
    expect(parseFdi('41')).toMatchObject({ arch: 'lower', side: 'right', dentition: 'permanent' })
    expect(parseFdi('51')).toMatchObject({ arch: 'upper', side: 'right', dentition: 'primary' })
    expect(parseFdi('71')).toMatchObject({ arch: 'lower', side: 'left', dentition: 'primary' })
  })
})

describe('toothType', () => {
  it('classifies the permanent dentition', () => {
    expect(toothType('11')).toBe('incisor')
    expect(toothType('12')).toBe('incisor')
    expect(toothType('13')).toBe('canine')
    expect(toothType('14')).toBe('premolar')
    expect(toothType('15')).toBe('premolar')
    expect(toothType('16')).toBe('molar')
    expect(toothType('48')).toBe('molar')
  })

  it('treats primary positions 4 and 5 as molars, not premolars', () => {
    // The primary dentition has no premolars at all; the successors do.
    expect(toothType('54')).toBe('molar')
    expect(toothType('75')).toBe('molar')
    expect(toothType('53')).toBe('canine')
  })
})

describe('surfacesFor', () => {
  it('gives anteriors a labial face and an incisal edge', () => {
    expect(surfacesFor('11')).toEqual(['mesial', 'distal', 'labial', 'palatal', 'incisal'])
    expect(surfacesFor('33')).toEqual(['mesial', 'distal', 'labial', 'lingual', 'incisal'])
  })

  it('gives posteriors a buccal face and an occlusal table', () => {
    expect(surfacesFor('16')).toEqual(['mesial', 'distal', 'buccal', 'palatal', 'occlusal'])
    expect(surfacesFor('36')).toEqual(['mesial', 'distal', 'buccal', 'lingual', 'occlusal'])
  })

  it('never offers palatal on a lower tooth or lingual on an upper one', () => {
    for (const fdi of allTeeth('permanent')) {
      const surfaces = surfacesFor(fdi)
      const upper = parseFdi(fdi).arch === 'upper'
      expect(surfaces).toContain(upper ? 'palatal' : 'lingual')
      expect(surfaces).not.toContain(upper ? 'lingual' : 'palatal')
    }
  })

  it('always returns exactly five distinct surfaces', () => {
    for (const fdi of [...allTeeth('permanent'), ...allTeeth('primary')]) {
      const surfaces = surfacesFor(fdi)
      expect(surfaces).toHaveLength(5)
      expect(new Set(surfaces).size).toBe(5)
    }
  })
})

describe('mesialOnRight — the mirroring rule', () => {
  it('points mesial to the viewer right for the patient right quadrants', () => {
    // The chart faces the patient, so patient-right is viewer-left and mesial points inward.
    for (const quadrant of [1, 4, 5, 8]) expect(mesialOnRight(`${quadrant}1`)).toBe(true)
    for (const quadrant of [2, 3, 6, 7]) expect(mesialOnRight(`${quadrant}1`)).toBe(false)
  })

  it('mirrors the left and right segments of the surface glyph accordingly', () => {
    expect(segmentMap('11').right).toBe('mesial')
    expect(segmentMap('11').left).toBe('distal')
    expect(segmentMap('21').right).toBe('distal')
    expect(segmentMap('21').left).toBe('mesial')
  })
})

describe('segmentMap', () => {
  it('puts the facial surface away from the occlusal plane', () => {
    // Upper teeth hang down, so their facial surface is the top of the glyph; lowers invert.
    expect(segmentMap('16').top).toBe('buccal')
    expect(segmentMap('16').bottom).toBe('palatal')
    expect(segmentMap('36').top).toBe('lingual')
    expect(segmentMap('36').bottom).toBe('buccal')
  })

  it('puts the biting surface in the centre', () => {
    expect(segmentMap('16').center).toBe('occlusal')
    expect(segmentMap('11').center).toBe('incisal')
  })

  it('only ever uses surfaces the tooth actually has', () => {
    for (const fdi of allTeeth('permanent')) {
      const map = segmentMap(fdi)
      const valid = surfacesFor(fdi)
      for (const surface of Object.values(map)) expect(valid).toContain(surface)
    }
  })
})

describe('cellsForArch', () => {
  it('orders the upper arch 18 to 11 then 21 to 28, left to right on screen', () => {
    expect(fdis(cellsForArch('upper', 'permanent'))).toEqual([
      '18', '17', '16', '15', '14', '13', '12', '11',
      '21', '22', '23', '24', '25', '26', '27', '28',
    ])
  })

  it('orders the lower arch 48 to 41 then 31 to 38', () => {
    expect(fdis(cellsForArch('lower', 'permanent'))).toEqual([
      '48', '47', '46', '45', '44', '43', '42', '41',
      '31', '32', '33', '34', '35', '36', '37', '38',
    ])
  })

  it('places exactly one midline marker, in the centre', () => {
    const cells = cellsForArch('upper', 'permanent')
    const midlines = cells.filter((c) => c.kind === 'midline')
    expect(midlines).toHaveLength(1)
    expect(cells.indexOf(midlines[0])).toBe(8)
  })

  it('drops to five teeth per quadrant for the primary dentition', () => {
    expect(fdis(cellsForArch('upper', 'primary'))).toEqual([
      '55', '54', '53', '52', '51', '61', '62', '63', '64', '65',
    ])
  })

  it('does not assume 32 teeth in mixed dentition', () => {
    // A slot mid-eruption holds neither tooth; the arch must stay aligned around the gap.
    const mixed = cellsForArch('upper', 'mixed', { '11': 'permanent', '12': 'absent', '13': 'primary' })
    expect(mixed.find((c) => c.kind === 'unerupted')).toBeDefined()
    expect(fdis(mixed)).toContain('11')
    expect(fdis(mixed)).toContain('53')
    expect(fdis(mixed)).not.toContain('12')
    // The gap still occupies a slot, so both quadrants keep their full width.
    expect(mixed).toHaveLength(17)
  })
})

describe('positionKey / fdiForPosition', () => {
  it('gives a primary tooth and its successor the same slot identity', () => {
    expect(positionKey('53')).toBe('13')
    expect(positionKey('13')).toBe('13')
    expect(positionKey('85')).toBe('45')
  })

  it('round-trips through both dentitions', () => {
    expect(fdiForPosition('13', 'primary')).toBe('53')
    expect(fdiForPosition('13', 'permanent')).toBe('13')
    for (const fdi of allTeeth('primary')) {
      expect(fdiForPosition(positionKey(fdi), 'primary')).toBe(fdi)
    }
  })
})

describe('allTeeth', () => {
  it('counts 32 permanent and 20 primary teeth', () => {
    expect(allTeeth('permanent')).toHaveLength(32)
    expect(allTeeth('primary')).toHaveLength(20)
  })

  it('produces no duplicates', () => {
    const teeth = allTeeth('permanent')
    expect(new Set(teeth).size).toBe(teeth.length)
  })
})

describe('toothName', () => {
  it('names teeth by the patient side', () => {
    expect(toothName('11')).toBe('Upper right central incisor')
    expect(toothName('24')).toBe('Upper left first premolar')
    expect(toothName('36')).toBe('Lower left first molar')
    expect(toothName('53')).toBe('Upper right canine (primary)')
  })
})

describe('Universal numbering (the clinic chart in the brief)', () => {
  it('runs 1-16 across the upper arch, left to right on screen', () => {
    // 1 is the patient's upper RIGHT third molar, which sits on the viewer's left.
    expect(fdis(cellsForArch('upper', 'permanent')).map(toUniversal)).toEqual([
      '1', '2', '3', '4', '5', '6', '7', '8',
      '9', '10', '11', '12', '13', '14', '15', '16',
    ])
  })

  it('runs 32 down to 17 across the lower arch, left to right on screen', () => {
    // The count loops: 17 is the lower LEFT third molar, so screen order descends.
    expect(fdis(cellsForArch('lower', 'permanent')).map(toUniversal)).toEqual([
      '32', '31', '30', '29', '28', '27', '26', '25',
      '24', '23', '22', '21', '20', '19', '18', '17',
    ])
  })

  it('pins the four corner teeth', () => {
    expect(toUniversal('18')).toBe('1')
    expect(toUniversal('28')).toBe('16')
    expect(toUniversal('38')).toBe('17')
    expect(toUniversal('48')).toBe('32')
  })

  it('letters the primary dentition A-T in the same loop', () => {
    expect(toUniversal('55')).toBe('A')
    expect(toUniversal('51')).toBe('E')
    expect(toUniversal('61')).toBe('F')
    expect(toUniversal('65')).toBe('J')
    expect(toUniversal('71')).toBe('K')
    expect(toUniversal('75')).toBe('O')
    expect(toUniversal('85')).toBe('P')
    expect(toUniversal('81')).toBe('T')
  })

  it('assigns every permanent tooth a distinct number 1-32', () => {
    const numbers = allTeeth('permanent').map(toUniversal).map(Number)
    expect(new Set(numbers).size).toBe(32)
    expect(Math.min(...numbers)).toBe(1)
    expect(Math.max(...numbers)).toBe(32)
  })

  it('assigns every primary tooth a distinct letter A-T', () => {
    const letters = allTeeth('primary').map(toUniversal)
    expect(new Set(letters).size).toBe(20)
  })
})

describe('Palmer notation', () => {
  it('brackets the position number by quadrant', () => {
    expect(toPalmer('18')).toBe('8┘')
    expect(toPalmer('28')).toBe('└8')
    expect(toPalmer('38')).toBe('┌8')
    expect(toPalmer('48')).toBe('8┐')
  })

  it('letters primary teeth A-E', () => {
    expect(toPalmer('53')).toBe('C┘')
    expect(toPalmer('75')).toBe('┌E')
  })
})
