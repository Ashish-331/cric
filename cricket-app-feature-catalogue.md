# Cricket Scoring & Management App — Feature Catalogue

## Project Overview

A cricket platform for **players, teams, scorers, tournament organisers, and spectators**.

The app supports ball-by-ball scoring, player and team profiles, career statistics, tournament management, and live match viewing. **Scoring works offline**, with updates synchronising when connectivity returns.

**Authentication:** mobile number + OTP. Players can be added without registering and claim their profiles later.

> **Budget note:** real SMS OTP delivery generally requires a paid provider or limited promotional allowance. It should not be assumed to remain free indefinitely.

## Feature Priorities

- **Core:** first dependable release.
- **Complete:** full club and tournament platform.
- **Advanced:** optional expansion after the core is proven.

---

## 1. Mobile OTP Authentication & Accounts

### Core
- Sign up and log in using a mobile number.
- Country-code selection and number validation.
- OTP verification.
- Resend OTP with countdown.
- OTP expiry and incorrect-code handling.
- Limits on repeated OTP requests and verification attempts.
- Stay signed in.
- Log out.
- Basic onboarding: name, location, player role.
- Browse public matches without logging in.
- Start guest scoring without an account.
- Link guest-created records to an account later.

### Complete
- Secure mobile-number change.
- Account recovery when the old number is unavailable.
- Active-session/device management.
- Log out from other devices.
- Account export and deletion.
- Consent and notification preferences.
- Account suspension and appeal process.

**Identity rule:** one verified account must not automatically gain ownership of every player record containing the same number. Profile claims need appropriate review.

## 2. Home Screen & Navigation

### Core
- Start a match.
- Resume an ongoing match.
- View recent matches.
- Access players and teams.
- View live, upcoming, and completed matches.
- Search public matches.
- Clearly display offline and pending-sync status.

### Complete
- Personalised matches of interest.
- Followed players, teams, and tournaments.
- Upcoming fixtures.
- Recent performances and achievements.
- Invitations, approvals, and action reminders.

## 3. Player Profiles

### Core
- Unique player identity.
- Name, photograph, and location.
- Playing role: batter, bowler, all-rounder, wicketkeeper.
- Batting hand.
- Bowling style.
- Team associations.
- Match history.
- Batting, bowling, and fielding statistics.
- Public/private profile controls.
- Shareable player profile.
- Create an unregistered player.
- Claim an existing profile after mobile verification.

### Complete
- Profile-claim review.
- Duplicate-player detection and reviewed merging.
- Season and format filters.
- Recent-form tracking.
- Personal bests and milestones.
- Awards and badges.
- Player comparisons.
- Private availability information.
- Separate verified, friendly, imported, and custom-rule records.

### Advanced
- Academy and club affiliations.
- Player discovery and recruitment profiles.
- Detailed opposition, venue, and phase analysis.
- Optional performance media links.

## 4. Team Profiles & Management

### Core
- Team name, short name, logo, and location.
- Team owner and managers.
- Player roster.
- Captain and wicketkeeper.
- Match history.
- Results and team statistics.
- Shareable team profile.

### Complete
- Multiple squads and season-specific rosters.
- Player invitations and join requests.
- Add/remove players without changing historical lineups.
- Player availability and match selection.
- Private team announcements.
- Upcoming fixtures.
- Head-to-head records.
- Team achievements and trophies.
- Manager permissions.
- Ownership transfer.
- Private roster and attendance settings.

### Advanced
- Find opponents.
- Friendly-match challenges.
- Club profiles containing multiple teams.
- Practice-session scheduling.

## 5. Match Creation & Setup

### Core
- Select or create two teams.
- Choose the playing lineup.
- Select match date, time, and venue.
- Select ball type.
- Choose supported limited-overs format.
- Custom overs and player count.
- Record captain and wicketkeeper.
- Record toss winner and decision.
- Select opening batters and bowler.
- Assign scorer.
- Set public, unlisted, or private visibility.

### Complete
- Tournament-linked matches.
- Reusable match templates.
- Competition-specific rules.
- Bowler limits.
- Powerplay settings.
- Wide/no-ball penalties.
- Free-hit settings.
- Retirement rules.
- Custom boundary values.
- Super-over settings.
- Officials and approvers.
- Scheduled, draft, live, paused, and completed states.

### Advanced
- Multi-day and multiple-innings formats.
- Follow-on and declaration settings.
- Session and new-ball configuration.

**Custom-rule matches are clearly labelled and can be excluded from standard leaderboards.**

## 6. Ball-by-Ball Scoring

### Core
- One-tap scoring for 0, 1, 2, 3, 4, and 6.
- Custom run entry.
- Distinguish boundaries from runs completed.
- Wides.
- No-balls.
- Byes.
- Leg-byes.
- Penalty runs.
- Wicket entry.
- Automatic strike rotation.
- Manual end correction with a recorded reason.
- Automatic legal-ball and over counting.
- Bowler selection at over end.
- Batter selection after dismissal.
- Current batter and bowler figures.
- Current and required run rate.
- Target and runs/balls remaining.
- End-of-innings detection.
- Match-result calculation.

### Complete
- No-ball combined with bat runs or other extras.
- Wides combined with completed runs.
- Run-out of striker or non-striker.
- Free-hit handling.
- Short runs.
- Overthrows.
- Dead-ball decisions.
- Retirement and return.
- Substitutes and replacements under supported rules.
- Bowler-limit warnings.
- Powerplay/phase indicators.
- Umpire-directed adjustments with an audit trail.
- Super-over scoring.

### Advanced
- Optional shot direction and type.
- Optional delivery line and length.
- Field-placement records.
- Dropped chances and fielding observations.
- Multi-day sessions, declarations, follow-on, and new-ball tracking.

## 7. Dismissal & Player-Status Workflows

For each supported dismissal, record the dismissed player and relevant bowler/fielder attribution.

- Bowled.
- Caught.
- Caught and bowled.
- LBW.
- Run out.
- Stumped.
- Hit wicket.
- Obstructing the field.
- Hit the ball twice.
- Timed out.
- Retired out.

Separately support:

- Retired hurt or other permitted retirement.
- Return to the innings where allowed.
- Absent hurt.
- Did not bat.

The app validates dismissal restrictions against the selected match rules.

## 8. Undo, Corrections & Match Integrity

### Core
- Undo the latest scoring action.
- Review recent deliveries.
- Correct an earlier delivery.
- Recalculate affected scorecard figures.
- Restore strike and player state correctly.

### Complete
- Full correction history.
- Actor, time, and reason for significant edits.
- Flag later actions invalidated by a correction.
- Scorer handover.
- One active scoring authority per match.
- Match sign-off and approval.
- Dispute a scorecard.
- Reopen an approved match through authorised review.
- Correct affected career statistics and standings.
- Distinguish provisional and approved results.

### Advanced
- Independent second-scorer mode.
- Compare and reconcile two scorebooks.

## 9. Offline Scoring, Recovery & Synchronisation

### Core
- Score without an internet connection.
- Save every confirmed action locally.
- Resume after closing or restarting the app.
- Preserve players, teams, lineups, and match rules offline.
- Clear “saved locally” and “synced” indicators.
- Sync pending records when connectivity returns.
- Export/import a full match backup.

### Complete
- Interrupted-sync recovery.
- Duplicate-upload prevention.
- Conflict review.
- Stale-device handling after scorer handover.
- Local-storage health warnings.
- Backup reminders.
- Device migration using export/import.
- Continue local scoring during cloud-service outages.

**Remote spectators see the last successfully synchronised score—not unsent offline updates.**

## 10. Live Match Centre & Scorecards

### Core
- Shareable match link.
- Live score and match status.
- Batting scorecard.
- Bowling scorecard.
- Extras breakdown.
- Dismissal descriptions.
- Current batters and bowler.
- Target, required rate, and result.
- Ball-by-ball timeline.
- Last-updated time.

### Complete
- Partnerships.
- Fall of wickets.
- Over summaries.
- Boundary counts.
- Powerplay/phase summaries.
- Template-based commentary.
- Worm chart.
- Manhattan chart.
- Run-rate chart.
- Innings comparison.
- Player-of-the-match display.
- Delayed-score/scorer-offline notice.
- Downloadable PDF.
- Shareable scorecard image.
- Match report.

### Advanced
- Wagon wheel where shot directions were recorded.
- Detailed pitch maps where delivery locations were recorded.
- External video links and timestamps.
- Broadcast scoreboard overlays.

## 11. Player Statistics & Records

### Batting
- Matches, innings, runs, and balls faced.
- Outs and not-outs.
- Average and strike rate.
- Highest score.
- Ducks.
- Fifties and hundreds.
- Fours and sixes.
- Boundary contribution.
- Dot-ball statistics.
- Batting-position performance.
- Partnerships.
- Recent form.

### Bowling
- Legal balls and overs.
- Runs conceded.
- Credited wickets.
- Maidens.
- Economy.
- Bowling average and strike rate.
- Best figures.
- Four/five-wicket hauls.
- Wides and no-balls.
- Phase performance.

### Fielding
- Catches.
- Stumpings.
- Direct and assisted run-outs.
- Wicketkeeping contributions.
- Optional recorded dropped chances.

### Filters and Comparisons
- Format.
- Season/date range.
- Team.
- Tournament.
- Ball type.
- Opposition.
- Venue.
- Verified versus unverified matches.
- Standard versus custom rules.
- Imported versus fully scored matches.

Statistics requiring unrecorded information are shown as unavailable—not guessed.

## 12. Team Statistics & Records

- Matches played.
- Wins, losses, ties, and no-results.
- Win percentage with a documented definition.
- Highest and lowest totals.
- Biggest victories.
- Successful chases and defended totals.
- Runs scored and conceded.
- Wickets taken and lost.
- Extras conceded.
- Head-to-head results.
- Recent form.
- Season performance.
- Top team batters and bowlers.
- Partnership records.
- Venue and toss-related analysis.
- Tournament achievements.

## 13. Tournament Management

### Complete
- Tournament name, logo, location, and organiser profile.
- Dates, venues, and competition rules.
- Team registration and approval.
- Squad registration and eligibility.
- League, knockout, and hybrid formats.
- Groups and stages.
- Fixture generation.
- Manual fixture editing.
- Venue/time conflict warnings.
- Scorer and official assignment.
- Public schedule.
- Points table.
- Configurable points and tie-breakers.
- Net run rate.
- Walkovers, ties, abandoned matches, and no-results.
- Qualification and knockout brackets.
- Tournament leaderboards.
- Awards and final report.
- Match-result approval and disputes.

### Advanced
- Qualification scenarios.
- Scheduling optimisation.
- Auctions/drafts.
- Sponsor sections.
- Tournament news and announcements.

## 14. Interrupted Matches & Special Results

- Rain/weather interruption.
- Pause and resume.
- Reduced-overs settings.
- Official revised-target entry.
- Record the adjustment method/source.
- Abandoned match.
- No result.
- Walkover.
- Forfeit/concession.
- Tie.
- Super over.
- Correct winner and victory margin.

**Automatic DLS calculation is a separate advanced feature requiring verified methodology and usage rights.**

## 15. Leaderboards, Awards & Achievements

### Complete
- Batting, bowling, and fielding leaderboards.
- Team rankings.
- Tournament and season rankings.
- Minimum participation thresholds.
- Visible sample size.
- Player of the match.
- Player of the tournament.
- Best batter/bowler/fielder.
- Milestone badges.
- Manual awards.
- Formula-based MVP with its scoring method disclosed.

### Advanced
- Location-based rankings.
- Achievement cards.
- Season honours.
- Scorer recognition based on transparent criteria.

## 16. Search, Discovery & Community

### Core/Complete
- Search players, teams, matches, and tournaments.
- Filter by location, format, date, and status.
- Follow players, teams, and tournaments.
- Find upcoming public fixtures.

### Advanced
- Find opponents and available players.
- Discover grounds, clubs, and academies.
- Find scorers and umpires.
- Team challenges.
- Community announcements.
- Moderated comments and reactions.
- Private team communication.
- Block/report tools.

## 17. Notifications

- OTP and security-related messages.
- Team invitations.
- Profile-claim decisions.
- Fixture reminders.
- Match-start notifications.
- Final results.
- Followed-player milestones.
- Scorer assignments.
- Approval/dispute reminders.
- Tournament announcements.
- Sync and backup warnings.

Include per-category preferences and quiet hours. Delivery channels depend on permissions and provider availability.

## 18. Sharing, Exports & Data Ownership

- Share player, team, match, and tournament links.
- Export scorecards as PDF/images.
- Export statistics as CSV.
- Export full records for backup.
- Import compatible backups.
- Import historical summary scorecards.
- Clearly label summary-only imports.
- Preview imports and detect duplicates.
- Export personal account data.

Imported totals must not fabricate a ball-by-ball history.

## 19. Privacy, Safety & Administration

### User-Facing Controls
- Public/private profiles and matches.
- Unlisted sharing.
- Private phone numbers.
- Conservative privacy defaults for minors.
- Report impersonation or incorrect records.
- Block/report community users.
- Account deletion and data export.

### Administration
- Manage scoped roles and permissions.
- Review profile claims and duplicate merges.
- Resolve scorecard disputes.
- Review suspicious matches/statistics.
- Suspend abusive accounts.
- Moderate public content.
- Audit administrative actions.
- Manage ruleset versions.
- Monitor storage and service quotas.
- Restore backups.
- Rebuild scorecards, statistics, and standings.

## 20. Usability & Accessibility

- Mobile-first scoring controls.
- Large touch targets.
- High-contrast/sunlight-friendly mode.
- Light and dark themes.
- Clear confirmation for destructive actions.
- Screen-reader labels.
- Keyboard navigation where applicable.
- Low-data mode.
- Consistent date/time and timezone handling.
- Multilingual interface expansion.
- Accessible loading, error, offline, and empty states.

---

## First-Release Feature Set

**Mobile OTP login + guest scoring + player profiles + team profiles + match setup + dependable ball-by-ball scoring + undo/correction + offline recovery + cloud sync + live scorecards + career statistics + sharing/export.**

## Subsequent Expansion

**Tournaments + standings/NRR + advanced analytics + discovery/community + broadcast tools.**
