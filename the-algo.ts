type RawMemberStats = {
  name: string
  draftsAttended: number
  draftPercentile: number
  draftPositionTotal: number
  averageDraftPosition: number
}

type MemberStats = {
  id: string
  name: string
  draftsAttended: number
  averageDraftPosition: number | string
  averagePercentilePerDraft: number | string
  shaftOMeter: number | string
}

const getMean = (arr: number[]) => {
  const sum = arr.reduce((acc, val) => acc + val, 0)
  return sum / arr.length
}

const getStandardDeviation = (arr: number[]) => {
  const mean = getMean(arr)
  const squareDiffs = arr.map((value) => {
    const diff = value - mean
    const sqrDiff = diff * diff
    return sqrDiff
  })
  const avgSquareDiff = getMean(squareDiffs)
  const stdDev = Math.sqrt(avgSquareDiff)
  return stdDev
}

const getMemberDeviation = (memberNum: number, allMemberNums: number[]) => {
  const mean = getMean(allMemberNums)
  const standardDeviation = getStandardDeviation(allMemberNums)
  const memberDiff = mean - memberNum
  const memberDeviation = memberDiff / standardDeviation

  return {
    standardDeviation,
    memberDeviation,
  }
}

const clampNumber = (num: number, min: number, max: number) =>
  Math.max(Math.min(num, max), min)

/**
 * The shaft-o-meter is a weighted 0-5 scale of how unlucky the draft
 * outcomes have been for a member. 0 is the most unlucky, 5 is the
 * least unlucky. It is calculated based on the average percentile of the
 * member's draft position relative to all members' draft positions.
 */
const getShaftOMeterScore = (
  rawMemberStats: RawMemberStats,
  allMemberPercentiles: number[],
  allAveragePositions: number[]
) => {
  const {
    draftPercentile: memberPercentile,
    averageDraftPosition: memberAveragePosition,
  } = rawMemberStats

  const { memberDeviation: memberPercentileDeviation } = getMemberDeviation(
    memberPercentile,
    allMemberPercentiles
  )

  const { memberDeviation: memberAveragePositionDeviation } = getMemberDeviation(
    memberAveragePosition,
    allAveragePositions
  )

  const averageMemberDeviation =
    (memberPercentileDeviation + memberAveragePositionDeviation) / 2

  return clampNumber(Math.ceil(2.5 - averageMemberDeviation), 0, 5)
}

type HouseMember = { id: string; name: string }

type BedDraft = {
  attendees: {
    position: number
    user: {
      id: string
    }
  }[]
}

export const getMemberStats = (
  members: HouseMember[],
  drafts: BedDraft[]
): MemberStats[] => {
  const memberPercentiles: number[] = []
  const memberAveragePositions: number[] = []

  return members
    .map((member) => {
      let draftsAttended = 0
      let draftPositionTotal = 0
      let totalPicksInDraftsAttended = 0

      drafts.forEach((draft) => {
        const attendanceRecord = draft.attendees.find(
          (attendee) => attendee.user.id === member.id
        )

        if (!attendanceRecord) return

        draftsAttended += 1
        draftPositionTotal += attendanceRecord.position + 1
        totalPicksInDraftsAttended += draft.attendees.length
      })

      const averageDraftPosition =
        Math.round((draftPositionTotal / draftsAttended) * 10) / 10
      const draftPercentile =
        Math.round(
          ((draftPositionTotal - 1) / totalPicksInDraftsAttended) * 1000
        ) / 10

      if (draftsAttended > 0) {
        memberPercentiles.push(draftPercentile)
        memberAveragePositions.push(averageDraftPosition)
      }

      return {
        id: member.id,
        name: member.name,
        draftsAttended,
        draftPercentile,
        draftPositionTotal,
        averageDraftPosition,
      }
    })
    .map((rawMemberStats) => {
      const { id, name, draftPercentile, draftPositionTotal, draftsAttended } =
        rawMemberStats

      let averageDraftPosition: number | string = 'N/A'
      let averagePercentilePerDraft: number | string = 'N/A'
      let shaftOMeter: number | string = 'N/A'

      if (draftsAttended > 0) {
        averageDraftPosition =
          Math.round((draftPositionTotal / draftsAttended) * 10) / 10
        /**
         * Since a high percentile is a good thing, we want to invert the value.
         */
        averagePercentilePerDraft = `${(100 - draftPercentile).toFixed(1)}%`
        shaftOMeter = getShaftOMeterScore(
          rawMemberStats,
          memberPercentiles,
          memberAveragePositions
        )
      }

      return {
        id,
        name,
        draftsAttended,
        averageDraftPosition,
        averagePercentilePerDraft,
        shaftOMeter,
      }
    })
}
