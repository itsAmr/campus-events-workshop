import { pathToFileURL } from "node:url";
import { createDatabase, type CampusDatabase } from "./database.js";

type SeedEvent = {
  title: string;
  category: string;
  location: string;
  day: number;
  capacity?: number;
  online?: boolean;
};

const seedEvents: SeedEvent[] = [
  { title: "McGill Robotics Open House", category: "Engineering", location: "McConnell Engineering 204", day: 1 },
  { title: "Redbirds Home Opener", category: "Athletics", location: "Percival Molson Stadium", day: 2 },
  { title: "Sustainability Research Mixer", category: "Networking", location: "New Residence Hall", day: 3 },
  { title: "Intro to Indigenous Studies", category: "Academic", location: "Leacock 132", day: 4 },
  { title: "Midnight Kitchen Community Lunch", category: "Community", location: "University Centre", day: 5 },
  { title: "AI Ethics at McGill", category: "Academic", location: "Online", day: 6, online: true },
  { title: "Mac Campus Farm Tour", category: "Outdoors", location: "Macdonald Campus Farm", day: 7 },
  { title: "Student Jazz Night", category: "Arts", location: "Schulich Music Building", day: 8 },
  { title: "French Conversation Circle", category: "Language", location: "Ferrier Building 230", day: 9 },
  { title: "HackMcGill Lightning Talks", category: "Technology", location: "Trottier 0100", day: 10 },
  { title: "Graduate Funding Q&A", category: "Career", location: "Online", day: 11, online: true },
  { title: "Museum Collections Tour", category: "Arts", location: "Redpath Museum", day: 12 },
  { title: "Desautels Case Competition", category: "Business", location: "Bronfman 151", day: 13 },
  { title: "Campus Wellness Yoga", category: "Wellness", location: "Brown Student Services", day: 14 },
  { title: "Quebec Policy Debate", category: "Politics", location: "Arts W-215", day: 15 },
  { title: "Open Source Contribution Sprint", category: "Technology", location: "Trottier 3120", day: 16 },
  { title: "International Student Coffee Hour", category: "Community", location: "McLennan Library Lobby", day: 17 },
  { title: "Career Centre CV Clinic", category: "Career", location: "Online", day: 18, online: true },
  { title: "Mount Royal Sunrise Hike", category: "Outdoors", location: "Roddick Gates", day: 19 },
  { title: "Faculty of Science Poster Fair", category: "Science", location: "Otto Maass Lobby", day: 20 },
  { title: "Campus A Cappella Showcase", category: "Arts", location: "Pollack Hall", day: 21 },
  { title: "Montreal Startup Alumni Panel", category: "Networking", location: "New Residence Hall", day: 22 },
  { title: "Exam Study Skills Workshop", category: "Wellness", location: "Online", day: 23, online: true },
  { title: "McGill Ultimate Frisbee Tryout", category: "Athletics", location: "Forbes Field", day: 24 },
  { title: "Tiny Climate Action Workshop", category: "Sustainability", location: "Burnside 1B23", day: 25, capacity: 2 },
];

function isoAtDayOffset(day: number, hour: number): string {
  const date = new Date();
  date.setUTCHours(hour, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + day);
  return date.toISOString();
}

export function seedDatabase(db: CampusDatabase): void {
  const count = db.prepare("SELECT COUNT(*) AS count FROM events").get() as {
    count: number;
  };
  if (Number(count.count) > 0) return;

  const insert = db.prepare(`
    INSERT INTO events
      (title, description, category, starts_at, ends_at, location, capacity, meeting_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  db.exec("BEGIN IMMEDIATE");
  try {
    for (const event of seedEvents) {
      insert.run(
        event.title,
        `Join the McGill community for ${event.title.toLowerCase()}.`,
        event.category,
        isoAtDayOffset(event.day, 17),
        isoAtDayOffset(event.day, 19),
        event.location,
        event.capacity ?? 60,
        event.online ? `https://events.mcgill.ca/meet/${event.day}` : null,
      );
    }

    const fullEvent = db
      .prepare("SELECT id FROM events WHERE title = ?")
      .get("Tiny Climate Action Workshop") as { id: number };
    const insertRsvp = db.prepare(
      "INSERT INTO rsvps (event_id, email) VALUES (?, ?)",
    );
    insertRsvp.run(fullEvent.id, "martlet@mcgill.ca");
    insertRsvp.run(fullEvent.id, "redbird@mcgill.ca");
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const db = createDatabase();
  seedDatabase(db);
  db.close();
  console.log("Seeded 25 relative-date McGill events");
}
