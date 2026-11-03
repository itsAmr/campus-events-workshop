# Part 2 — Change the API without breaking its users

**Time:** 20 minutes  
**Goal:** change what the API sends and accepts without breaking anyone who already uses it.

## Your response is a promise

The moment a client reads your JSON, every field name, type, and format becomes something their code depends on. The web app in `web/src/api.ts` expects `location` to be a string, and timestamps like `2026-11-06T17:00:00.000Z`.

**Hyrum's law:** with enough users, every behavior they can observe will be depended on by somebody, whether you promised it or not.

An example from this repo: nobody documented the timestamp format, but clients rely on it. That's why Part 0 asked you to copy the `created_at` line. A database default of `CURRENT_TIMESTAMP` gives `2026-11-06 17:00:00`, with no `Z` to say it's UTC. Most browsers read a timestamp like that as local time, so a client in Montreal would show it 5 hours off. No error, no failed test: just wrong times.

## Discuss: breaking or not?

Your facilitator will run a quick vote. Would each change break an existing client?

1. Add a new optional field, `imageUrl`.
2. Rename `startsAt` to `startTime`.
3. Change `location` from a string to an object.
4. Return events newest first instead of soonest first.
5. Change timestamps from `2026-11-06T17:00:00.000Z` to `2026-11-06 17:00:00`.
6. Add a new category, `Gaming`.

<details>
<summary>Answers</summary>

1. Usually safe. Adding is the safest change there is, though a client that rejects unknown fields would still break.
2. Breaking. Every client reading `startsAt` now gets nothing.
3. Breaking. Code that shows `location` now shows `[object Object]` or crashes. You'll see it in 2.2.
4. Breaking for someone. The order was never promised, but a client showing "the next event" takes the first item. Hyrum's law.
5. Breaking. The meaning is the same, but the web app would show the wrong time. Hyrum's law again.
6. Usually safe, unless a client has a hardcoded list of categories.

</details>

## 2.1 Make a safe change

Some events are online, and the database already stores their meeting link in `meeting_url`. That column was added by `api/migrations/002_online_events.sql`: a new migration file, which is how a real project changes its database without editing old migrations. The API doesn't send the link yet.

Open `api/src/events/responses.ts`, find `TODO(part-2.1)`, and add `meetingUrl` to the response. Then:

- run `npm run check:2`;
- look at the web app: online events now show a **Join online** link.

Nothing else had to change. Clients that don't know about `meetingUrl` ignore it, and clients that do can use it right away.

## 2.2 Break it on purpose

Now try change 3 from the vote. Follow `TODO(part-2.2)` in the same file and change `location` to:

```ts
location: { name: event.location },
```

Look at the web app: it crashes, because it tries to show the `location` object as text (the browser console has the error). Run `npm run check:2`: the test "keeps every field clients already rely on" fails too. A test like that guards the promise, so a breaking change gets caught before clients see it.

**Undo the change** and reload the page before moving on.

## Requests can break too

Responses are what you promise to send. Requests are what you promise to accept, and the rules are mirrored:

| | Safe | Breaking |
| --- | --- | --- |
| **Responses** | send more: add a field | send less or different: remove, rename, or change a field's type |
| **Requests** | accept more: a new optional field, a looser rule | demand more: a new required field, a stricter rule, a renamed field |

A short way to remember it, known as Postel's law: be strict in what you send, and generous in what you accept.

Quick check. Breaking or not?

1. Make `meetingUrl` required when creating an event.
2. Allow titles up to 200 characters instead of 120.
3. Make `category` required when listing events.

<details>
<summary>Answers</summary>

1. Breaking. The web app's form doesn't send `meetingUrl`, so every new event would get a 400.
2. Safe. Every title that worked before still works.
3. Breaking. **All categories** in the web app sends no category. Your facilitator will show what happens, and why giving it a default isn't as safe as it looks.

</details>

The request schemas in `api/src/events/requests.ts` ignore fields they don't know, which is generous too: a client can send an extra field without getting a 400.

## What would force a v2?

Suppose we really did need `location` to be an object. We can't change it in v1 without breaking every client, so we'd ship a second version next to the first:

```ts
app.get("/api/v2/events/:id", (request, response) => {
  const event = getEvent(db, readEventId(request));
  response.json({ data: toEventV2(event) });
});
```

The database and `store.ts` stay the same; only the response changes. v1 keeps working, clients move to v2 when they're ready, and v1 is only switched off once nobody uses it. APIs usually announce this with `Deprecation` and `Sunset` response headers.

That's why every URL has had `/v1` in it from day one: it looks unnecessary with one version, and makes the second one cheap.

## Decisions that make changes cheap

These were made on day one, before anyone needed them:

- **The version is in the URL.** A v2 is just another prefix.
- **Responses are wrapped in `{ data: ... }`.** Paging info or warnings can go next to `data` later without breaking anything.
- **Errors have codes.** Clients check `ALREADY_RSVPED`, not the wording of a message, so messages can be improved freely.
- **Response functions are separate from database rows.** Renaming a column changes `responses.ts`, not every client.

And one this API got wrong: `location` is a plain string. When something is likely to grow more details, make it an object from the start.

## Done when

```bash
npm run check:2
```

- [ ] Every Part 2 test passes.
- [ ] Online events show **Join online** in the web app.
- [ ] `location` is a string again, and the Part 2 TODO comments are deleted.

Stuck? Run `git stash`, then `git switch checkpoint/2-responses` and `npm run db:reset`.
