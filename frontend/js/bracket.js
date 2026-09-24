import { supabase } from './supabase.js';
import { toast } from './app.js';

/**
 * Generate Group Stage + Knockout bracket for a tournament.
 * Call this from the organiser panel when you want to generate the bracket.
 *
 * @param {string} tournamentId
 */
export async function generateBracket(tournamentId) {
  // Fetch approved registrations ordered by seed
  const { data: regs, error } = await supabase
    .from('registrations')
    .select('id, seed')
    .eq('tournament_id', tournamentId)
    .eq('status', 'approved')
    .order('seed', { nullsFirst: false })
    .order('created_at');

  if (error || !regs?.length) { toast('No approved registrations found.', 'error'); return; }

  // Delete existing matches
  await supabase.from('matches').delete().eq('tournament_id', tournamentId);

  const teams = regs.map(r => r.id);
  const numTeams = teams.length;

  // Determine groups of 4 (pad with BYEs = null)
  const groupSize = 4;
  const numGroups = Math.max(1, Math.ceil(numTeams / groupSize));
  const totalSlots = numGroups * groupSize;
  const padded = [...teams];
  while (padded.length < totalSlots) padded.push(null); // null = BYE

  // Shuffle non-seeded teams within their slot positions
  const groupNames = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const matchInserts = [];
  let matchNum = 1;
  let round = 1;

  // Group stage: round-robin within each group
  for (let g = 0; g < numGroups; g++) {
    const groupLabel = groupNames[g];
    const groupTeams = padded.slice(g * groupSize, g * groupSize + groupSize);

    // All pairs within group (round-robin)
    for (let i = 0; i < groupTeams.length; i++) {
      for (let j = i + 1; j < groupTeams.length; j++) {
        const t1 = groupTeams[i];
        const t2 = groupTeams[j];
        const isBye = !t1 || !t2;

        matchInserts.push({
          tournament_id: tournamentId,
          round,
          match_number: matchNum++,
          phase: 'group',
          group_name: groupLabel,
          team1_reg_id: t1,
          team2_reg_id: t2,
          status: isBye ? 'bye' : 'scheduled',
        });
      }
    }
    round++;
  }

  // Knockout stage: seeded placeholders (top 2 from each group)
  // Number of knockout teams = numGroups * 2 (or next power of 2)
  const koTeams = numGroups * 2;
  const koPow = nextPow2(koTeams);
  // Generate slots: koTeams actual + BYEs to fill koPow
  const koSlots = koPow;

  let phase;
  if (koSlots === 2)  phase = 'final';
  else if (koSlots === 4)  phase = 'semi_final';
  else if (koSlots === 8)  phase = 'quarter_final';
  else phase = 'quarter_final';

  // Knockout round pairings (TBD — filled after group stage)
  for (let i = 0; i < koSlots / 2; i++) {
    matchInserts.push({
      tournament_id: tournamentId,
      round: round,
      match_number: matchNum++,
      phase,
      status: 'scheduled',
      team1_reg_id: null,
      team2_reg_id: null,
    });
  }

  round++;
  let remaining = koSlots / 2;
  while (remaining > 1) {
    const nextPhase = getNextPhase(phase);
    for (let i = 0; i < remaining / 2; i++) {
      matchInserts.push({
        tournament_id: tournamentId,
        round,
        match_number: matchNum++,
        phase: nextPhase,
        status: 'scheduled',
        team1_reg_id: null,
        team2_reg_id: null,
      });
    }
    if (remaining === 4) {
      // Add 3rd place match
      matchInserts.push({
        tournament_id: tournamentId,
        round,
        match_number: matchNum++,
        phase: 'third_place',
        status: 'scheduled',
        team1_reg_id: null,
        team2_reg_id: null,
      });
    }
    phase = nextPhase;
    remaining = remaining / 2;
    round++;
  }

  const { error: insertErr } = await supabase.from('matches').insert(matchInserts);
  if (insertErr) { toast('Failed to generate bracket: ' + insertErr.message, 'error'); return; }

  // Assign groups to registrations
  for (let g = 0; g < numGroups; g++) {
    const groupLabel = groupNames[g];
    const groupTeams = padded.slice(g * groupSize, g * groupSize + groupSize).filter(Boolean);
    if (groupTeams.length) {
      await supabase.from('registrations').update({ group_name: groupLabel }).in('id', groupTeams);
    }
  }

  // Update tournament status
  await supabase.from('tournaments').update({ status: 'ongoing', updated_at: new Date().toISOString() }).eq('id', tournamentId);

  toast('Bracket generated successfully!', 'success');
  return true;
}

function nextPow2(n) {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

function getNextPhase(current) {
  const order = ['quarter_final','semi_final','final'];
  const idx = order.indexOf(current);
  return idx < order.length - 1 ? order[idx + 1] : 'final';
}
