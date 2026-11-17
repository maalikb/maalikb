// Pulls the last year of the contribution calendar into data/contributions.json.
// Private contributions count too (the profile shows them), as totals per day only.
// Needs a token in GITHUB_TOKEN; the Action's own token is enough. Locally:
//   set -x GITHUB_TOKEN (gh auth token); bun run fetch
const LOGIN = "maalikb";
const OUT = new URL("../data/contributions.json", import.meta.url).pathname;

const token = process.env.GITHUB_TOKEN;
if (!token) throw new Error("GITHUB_TOKEN is not set");

const query = `query($login: String!) {
  user(login: $login) {
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount } }
      }
    }
  }
}`;

const res = await fetch("https://api.github.com/graphql", {
  method: "POST",
  headers: { Authorization: `bearer ${token}`, "Content-Type": "application/json", "User-Agent": "profile-cards" },
  body: JSON.stringify({ query, variables: { login: LOGIN } }),
});
if (!res.ok) throw new Error(`GitHub GraphQL ${res.status}: ${await res.text()}`);
const json = (await res.json()) as any;
if (json.errors) throw new Error(JSON.stringify(json.errors));

const cal = json.data.user.contributionsCollection.contributionCalendar;
const days: { date: string; count: number }[] = cal.weeks.flatMap((w: any) =>
  w.contributionDays.map((d: any) => ({ date: d.date, count: d.contributionCount })),
);

await Bun.write(OUT, JSON.stringify({ login: LOGIN, fetchedAt: new Date().toISOString(), total: cal.totalContributions, days }, null, 2) + "\n");
console.log(`${cal.totalContributions} contributions over ${days.length} days`);
