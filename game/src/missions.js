// Canyon Courier — sorties and scoring. A mission is a course of rings over
// one canyon; the score is rings flown plus the time and fuel left when the
// sortie ends, plus landing marks where a landing is the goal. Every number
// here is shown on the end screen, so the player can check the arithmetic.

import { MISSIONS, SCORE } from './config.js';

/** A fresh score sheet for a mission. */
export function newScoreSheet(mission) {
  return {
    missionId: mission.id,
    ringsHit: 0,
    ringsTotal: mission.rings,
    streak: 0,
    bestStreak: 0,
    ringPoints: 0,
    timeLeft: mission.timeLimit,
    timePoints: 0,
    fuelLeft: 100,
    fuelPoints: 0,
    landingPoints: 0,
    landingDetail: '',
    dropPoints: 0,
    dropDetail: '',
    total: 0,
  };
}

/** Award a ring: base points plus a streak bonus for three in a row. */
export function awardRing(sheet) {
  sheet.ringsHit += 1;
  sheet.streak += 1;
  sheet.bestStreak = Math.max(sheet.bestStreak, sheet.streak);
  let points = SCORE.ring;
  if (sheet.streak >= 3) points += SCORE.gateStreakBonus;
  sheet.ringPoints += points;
  return points;
}

/** A missed ring breaks the streak; the sortie goes on. */
export function missRing(sheet) {
  sheet.streak = 0;
}

/**
 * Score a landing from the touchdown itself: centreline alignment and how
 * gently the wheels met the strip. Returns the detail line for the screen.
 */
export function awardLanding(sheet, plane, runway) {
  const align = 1 - Math.min(1, Math.abs(plane.x) / runway.halfWidth);
  const soft = 1 - Math.min(1, Math.max(0, -plane.verticalSpeed) / 34);
  const alignPoints = Math.round(SCORE.landingAlignment * align);
  const softPoints = Math.round(SCORE.landingSoftness * soft);
  sheet.landingPoints = alignPoints + softPoints;
  sheet.landingDetail =
    `centreline ${Math.round(align * 100)}% (+${alignPoints}) · ` +
    `touchdown ${Math.round(soft * 100)}% soft (+${softPoints})`;
  return sheet.landingPoints;
}

/** Close the sheet at mission end: time and fuel bonuses, then the total. */
export function closeScoreSheet(sheet, timeLeft, fuelLeft) {
  sheet.timeLeft = Math.max(0, Math.round(timeLeft));
  sheet.fuelLeft = Math.max(0, Math.round(fuelLeft));
  sheet.timePoints = sheet.timeLeft * SCORE.timeBonusPerSecond;
  sheet.fuelPoints = sheet.fuelLeft * SCORE.fuelBonusPerPercent;
  sheet.total =
    sheet.ringPoints + sheet.timePoints + sheet.fuelPoints + sheet.landingPoints + sheet.dropPoints;
  return sheet;
}

/**
 * Score a supply drop from where the crate lands: full marks dead centre,
 * half inside the painted circle, nothing outside it. The wind pushes the
 * crate sideways while it falls, so the drop is a judgement call, not a
 * button press. Returns the detail line for the screen.
 */
export function awardDrop(sheet, missFeet, circleRadiusFeet) {
  const inside = missFeet <= circleRadiusFeet;
  const bullseye = missFeet <= circleRadiusFeet * 0.3;
  const points = bullseye
    ? SCORE.dropBullseye
    : inside
      ? SCORE.dropRing
      : 0;
  sheet.dropPoints = points;
  sheet.dropDetail = inside
    ? `drop ${Math.round(missFeet)} ft off centre (+${points})`
    : `drop missed by ${Math.round(missFeet)} ft (+0)`;
  return points;
}

/** The three sorties, in the order the title screen offers them. */
export function listMissions() {
  return MISSIONS;
}
