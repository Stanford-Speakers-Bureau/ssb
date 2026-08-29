import { createSeedClient } from "@snaplet/seed";
import { copycat } from "@snaplet/copycat";
import pgClient from "postgres";

const sql = pgClient("postgresql://postgres:postgres@127.0.0.1:54322/postgres");

// ── Seeded PRNG (mulberry32) ─────────────────────────────────────────────────
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(42);

function randBetween(min: number, max: number): number {
  return min + rng() * (max - min);
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

// ── Timestamp distribution generators ────────────────────────────────────────

type TimeSegment = {
  startFrac: number;
  endFrac: number;
  weight: number;
};

function generateTimestamps(
  count: number,
  startDate: Date,
  endDate: Date,
  segments: TimeSegment[],
): Date[] {
  if (count === 0) return [];
  const totalMs = endDate.getTime() - startDate.getTime();
  if (totalMs <= 0) return Array.from({ length: count }, () => new Date(startDate));

  const totalWeight = segments.reduce((sum, s) => sum + s.weight, 0);
  const timestamps: Date[] = [];

  for (const seg of segments) {
    const segCount = Math.round((seg.weight / totalWeight) * count);
    const segStartMs = startDate.getTime() + seg.startFrac * totalMs;
    const segEndMs = startDate.getTime() + seg.endFrac * totalMs;
    for (let i = 0; i < segCount; i++) {
      timestamps.push(new Date(segStartMs + rng() * (segEndMs - segStartMs)));
    }
  }

  while (timestamps.length < count) {
    timestamps.push(new Date(startDate.getTime() + rng() * totalMs));
  }
  timestamps.length = count;
  timestamps.sort((a, b) => a.getTime() - b.getTime());
  return timestamps;
}

// Ticket sales: huge spike at launch, slow middle, second spike near event
const SALE_SEGMENTS: TimeSegment[] = [
  { startFrac: 0, endFrac: 0.005, weight: 30 },
  { startFrac: 0.005, endFrac: 0.02, weight: 12 },
  { startFrac: 0.02, endFrac: 0.08, weight: 8 },
  { startFrac: 0.08, endFrac: 0.4, weight: 6 },
  { startFrac: 0.4, endFrac: 0.7, weight: 5 },
  { startFrac: 0.7, endFrac: 0.88, weight: 12 },
  { startFrac: 0.88, endFrac: 0.96, weight: 15 },
  { startFrac: 0.96, endFrac: 1.0, weight: 12 },
];

// Check-in: big wave at doors, lull, huge rush at start, stragglers
const CHECKIN_SEGMENTS: TimeSegment[] = [
  { startFrac: 0, endFrac: 0.1, weight: 22 },
  { startFrac: 0.1, endFrac: 0.25, weight: 8 },
  { startFrac: 0.25, endFrac: 0.45, weight: 6 },
  { startFrac: 0.45, endFrac: 0.6, weight: 12 },
  { startFrac: 0.6, endFrac: 0.75, weight: 30 },
  { startFrac: 0.75, endFrac: 0.85, weight: 14 },
  { startFrac: 0.85, endFrac: 1.0, weight: 8 },
];

// Partially sold: initial spike then trickle (still ongoing)
const PARTIAL_SALE_SEGMENTS: TimeSegment[] = [
  { startFrac: 0, endFrac: 0.01, weight: 35 },
  { startFrac: 0.01, endFrac: 0.05, weight: 15 },
  { startFrac: 0.05, endFrac: 0.2, weight: 12 },
  { startFrac: 0.2, endFrac: 0.5, weight: 10 },
  { startFrac: 0.5, endFrac: 0.8, weight: 15 },
  { startFrac: 0.8, endFrac: 1.0, weight: 13 },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}
function daysFromNow(n: number): Date {
  return new Date(Date.now() + n * 24 * 60 * 60 * 1000);
}
function setTime(date: Date, hours: number, minutes = 0): Date {
  const d = new Date(date);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

const FIRST_NAMES = [
  "Emma", "Liam", "Olivia", "Noah", "Ava", "Ethan", "Sophia", "Mason",
  "Isabella", "William", "Mia", "James", "Charlotte", "Benjamin", "Amelia",
  "Lucas", "Harper", "Henry", "Evelyn", "Alexander", "Abigail", "Daniel",
  "Emily", "Matthew", "Elizabeth", "Jackson", "Sofia", "Sebastian", "Avery",
  "Aiden", "Ella", "Owen", "Scarlett", "Samuel", "Grace", "Ryan", "Chloe",
  "Nathan", "Victoria", "Caleb", "Riley", "Dylan", "Aria", "Luke", "Lily",
  "Andrew", "Zoey", "Isaac", "Penelope", "Gabriel", "Layla", "Anthony",
  "Nora", "Jaxon", "Camila", "Levi", "Hannah", "Mateo", "Addison", "David",
  "Luna", "John", "Savannah", "Wyatt", "Leah", "Carter", "Aubrey", "Julian",
  "Ellie", "Jayden", "Stella", "Leo", "Natalie", "Lincoln", "Zoe", "Jose",
  "Paisley", "Christopher", "Hazel", "Joshua", "Aurora", "Priya", "Raj",
  "Wei", "Mei", "Hiroshi", "Yuki", "Sanjay", "Ananya", "Chen", "Jing",
  "Arjun", "Kavya", "Min", "Hana", "Ravi", "Deepa", "Kai", "Sakura",
];

const LAST_NAMES = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller",
  "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez",
  "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin",
  "Lee", "Perez", "Thompson", "White", "Harris", "Sanchez", "Clark",
  "Ramirez", "Lewis", "Robinson", "Walker", "Young", "Allen", "King",
  "Wright", "Scott", "Torres", "Nguyen", "Hill", "Flores", "Green",
  "Adams", "Nelson", "Baker", "Hall", "Rivera", "Campbell", "Mitchell",
  "Carter", "Roberts", "Patel", "Kumar", "Shah", "Kim", "Park", "Chen",
  "Wang", "Liu", "Zhang", "Li", "Yang", "Wu", "Huang", "Tanaka",
  "Yamamoto", "Nakamura", "Sato", "Suzuki", "Singh", "Sharma", "Gupta",
  "Agarwal", "Reddy", "Rao", "Mehta", "Joshi", "Verma", "Iyer", "Chopra",
];

function fakeName(seed: string): string {
  return `${copycat.oneOf(seed + "-f", FIRST_NAMES)} ${copycat.oneOf(seed + "-l", LAST_NAMES)}`;
}
function fakeEmail(seed: string): string {
  return copycat.email(seed).replace(/@.*/, "@stanford.edu").toLowerCase();
}

const SCANNERS = [
  { name: "Alex Chen", email: "alex.chen@stanford.edu" },
  { name: "Jordan Rivera", email: "jordan.rivera@stanford.edu" },
  { name: "Sam Patel", email: "sam.patel@stanford.edu" },
  { name: "Morgan Kim", email: "morgan.kim@stanford.edu" },
  { name: "Casey Wu", email: "casey.wu@stanford.edu" },
];

// ── Shared user pool for cross-event attendance tracking ──────────────────────
// These users appear across multiple past events with different attendance patterns.
// This lets the /attendance page show loyalists, flakers, returners, etc.

type SharedUser = {
  email: string;
  name: string;
  /** Probability of registering for any given past event (0-1) */
  registrationRate: number;
  /** Probability of showing up when registered (0-1) */
  showUpRate: number;
  /** Preferred ticket type */
  type: "STANDARD" | "VIP" | "EXTERNAL";
};

const SHARED_USERS: SharedUser[] = [
  // Loyalists — register often, always show up
  { email: "alex.loyalist@stanford.edu",    name: "Alex Loyalist",    registrationRate: 0.95, showUpRate: 1.0,  type: "STANDARD" },
  { email: "brooke.davis@stanford.edu",     name: "Brooke Davis",     registrationRate: 0.9,  showUpRate: 0.95, type: "STANDARD" },
  { email: "carlos.mendez@stanford.edu",    name: "Carlos Mendez",    registrationRate: 0.85, showUpRate: 1.0,  type: "STANDARD" },
  { email: "diana.patel@stanford.edu",      name: "Diana Patel",      registrationRate: 0.8,  showUpRate: 0.95, type: "VIP" },
  { email: "ethan.nakamura@stanford.edu",   name: "Ethan Nakamura",   registrationRate: 0.9,  showUpRate: 1.0,  type: "STANDARD" },
  // Flakers — register often, rarely show
  { email: "fiona.walsh@stanford.edu",      name: "Fiona Walsh",      registrationRate: 0.85, showUpRate: 0.0,  type: "STANDARD" },
  { email: "george.liu@stanford.edu",       name: "George Liu",       registrationRate: 0.8,  showUpRate: 0.1,  type: "STANDARD" },
  { email: "hannah.kim@stanford.edu",       name: "Hannah Kim",       registrationRate: 0.9,  showUpRate: 0.05, type: "STANDARD" },
  { email: "isaac.okafor@stanford.edu",     name: "Isaac Okafor",     registrationRate: 0.75, showUpRate: 0.0,  type: "STANDARD" },
  { email: "julia.santos@stanford.edu",     name: "Julia Santos",     registrationRate: 0.8,  showUpRate: 0.08, type: "STANDARD" },
  // Mixed — sometimes show, sometimes don't
  { email: "kevin.zhao@stanford.edu",       name: "Kevin Zhao",       registrationRate: 0.7,  showUpRate: 0.6,  type: "STANDARD" },
  { email: "lily.thompson@stanford.edu",    name: "Lily Thompson",    registrationRate: 0.65, showUpRate: 0.55, type: "STANDARD" },
  { email: "miguel.herrera@stanford.edu",   name: "Miguel Herrera",   registrationRate: 0.6,  showUpRate: 0.5,  type: "STANDARD" },
  { email: "nina.johansson@stanford.edu",   name: "Nina Johansson",   registrationRate: 0.55, showUpRate: 0.65, type: "VIP" },
  { email: "oscar.brown@stanford.edu",      name: "Oscar Brown",      registrationRate: 0.7,  showUpRate: 0.45, type: "STANDARD" },
  // Occasional — register less often
  { email: "priya.sharma@stanford.edu",     name: "Priya Sharma",     registrationRate: 0.4,  showUpRate: 0.8,  type: "STANDARD" },
  { email: "quinn.mitchell@stanford.edu",   name: "Quinn Mitchell",   registrationRate: 0.35, showUpRate: 0.7,  type: "STANDARD" },
  { email: "rachel.green@stanford.edu",     name: "Rachel Green",     registrationRate: 0.3,  showUpRate: 0.9,  type: "STANDARD" },
  { email: "sam.taylor@stanford.edu",       name: "Sam Taylor",       registrationRate: 0.45, showUpRate: 0.4,  type: "STANDARD" },
  { email: "tyler.adams@stanford.edu",      name: "Tyler Adams",      registrationRate: 0.35, showUpRate: 0.85, type: "STANDARD" },
  // VIP regulars
  { email: "zara.williams@stanford.edu",    name: "Zara Williams",    registrationRate: 0.85, showUpRate: 0.9,  type: "VIP" },
  { email: "aaron.foster@stanford.edu",     name: "Aaron Foster",     registrationRate: 0.75, showUpRate: 0.85, type: "VIP" },
  { email: "beth.martinez@stanford.edu",    name: "Beth Martinez",    registrationRate: 0.7,  showUpRate: 0.8,  type: "VIP" },
  { email: "chris.donovan@stanford.edu",    name: "Chris Donovan",    registrationRate: 0.5,  showUpRate: 0.7,  type: "VIP" },
  { email: "dana.morgan@stanford.edu",      name: "Dana Morgan",      registrationRate: 0.6,  showUpRate: 0.75, type: "EXTERNAL" },
];

function referralCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(rng() * chars.length)];
  return code;
}

// ── Event configurations ─────────────────────────────────────────────────────

type EventConfig = {
  name: string | null;
  title: string | null;
  tagline: string;
  desc: string;
  venue: string;
  venueLink: string;
  address: string;
  lat: number;
  lng: number;
  capacity: number;
  reserved: number;
  route: string;
  ticketingDate: Date;
  startTimeDate: Date;
  endTimeDate: Date;
  doorsOpen: Date;
  releaseDate: Date;
  live: boolean;
  standbyEnabled: boolean;
  referralsEnabled: boolean;
  hideTicketingDate: boolean;
  ticketCount: number;
  scannedFraction: number;
  waitlistCount: number;
  referralCodeCount: number;
  ticketTypes: { standard: number; vip: number; standby: number };
  saleSegments: TimeSegment[];
  priority: string | null;
};

const EVENT_CONFIGS: EventConfig[] = [
  {
    name: "Sam Altman", title: "The Future of Artificial Intelligence",
    tagline: "OpenAI CEO on what's next for AI",
    desc: "Join Sam Altman, CEO of OpenAI, as he discusses the trajectory of artificial intelligence, the promise and perils of AGI, and what it means for the next generation of builders.",
    venue: "NVIDIA Auditorium", venueLink: "https://maps.app.goo.gl/stanford-nvidia",
    address: "475 Via Ortega, Stanford, CA 94305", lat: 37.4275, lng: -122.1697,
    capacity: 350, reserved: 30, route: "sam-altman",
    ticketingDate: daysAgo(45), startTimeDate: setTime(daysAgo(14), 18, 30),
    endTimeDate: setTime(daysAgo(14), 20, 0),
    doorsOpen: setTime(daysAgo(14), 17, 45), releaseDate: daysAgo(50),
    live: false, standbyEnabled: true, referralsEnabled: true, hideTicketingDate: false,
    ticketCount: 320, scannedFraction: 0.94, waitlistCount: 85, referralCodeCount: 12,
    ticketTypes: { standard: 280, vip: 30, standby: 10 },
    saleSegments: SALE_SEGMENTS, priority: "high",
  },
  {
    name: "Jensen Huang", title: "Computing's Next Decade",
    tagline: "NVIDIA CEO on the accelerated computing revolution",
    desc: "Jensen Huang shares his vision for the future of computing—from AI infrastructure to digital twins—and why we're at the beginning of a new industrial revolution.",
    venue: "Memorial Auditorium", venueLink: "https://maps.app.goo.gl/stanford-memorial",
    address: "551 Serra Mall, Stanford, CA 94305", lat: 37.4326, lng: -122.1640,
    capacity: 450, reserved: 40, route: "jensen-huang",
    ticketingDate: daysAgo(60), startTimeDate: setTime(daysAgo(30), 19, 0),
    endTimeDate: setTime(daysAgo(30), 20, 45),
    doorsOpen: setTime(daysAgo(30), 18, 15), releaseDate: daysAgo(65),
    live: false, standbyEnabled: true, referralsEnabled: true, hideTicketingDate: false,
    ticketCount: 410, scannedFraction: 0.88, waitlistCount: 120, referralCodeCount: 18,
    ticketTypes: { standard: 360, vip: 40, standby: 10 },
    saleSegments: SALE_SEGMENTS, priority: "high",
  },
  {
    name: "Reshma Saujani", title: "Brave, Not Perfect",
    tagline: "Girls Who Code founder on redefining success",
    desc: "Reshma Saujani, founder of Girls Who Code, discusses building courage over perfection, closing the gender gap in tech, and why vulnerability is a superpower.",
    venue: "Cemex Auditorium", venueLink: "https://maps.app.goo.gl/stanford-cemex",
    address: "655 Knight Way, Stanford, CA 94305", lat: 37.4300, lng: -122.1660,
    capacity: 300, reserved: 20, route: "reshma-saujani",
    ticketingDate: daysAgo(40), startTimeDate: setTime(daysAgo(21), 18, 0),
    endTimeDate: setTime(daysAgo(21), 19, 30),
    doorsOpen: setTime(daysAgo(21), 17, 15), releaseDate: daysAgo(42),
    live: false, standbyEnabled: false, referralsEnabled: true, hideTicketingDate: false,
    ticketCount: 235, scannedFraction: 0.82, waitlistCount: 0, referralCodeCount: 8,
    ticketTypes: { standard: 220, vip: 15, standby: 0 },
    saleSegments: PARTIAL_SALE_SEGMENTS, priority: "high",
  },
  {
    name: "Sal Khan", title: "Education Reimagined with AI",
    tagline: "Khan Academy founder on AI tutoring for every student",
    desc: "Sal Khan unveils how AI is transforming personalized education and why the next decade will see a revolution in how every human learns.",
    venue: "Dinkelspiel Auditorium", venueLink: "https://maps.app.goo.gl/stanford-dinkelspiel",
    address: "471 Lagunita Dr, Stanford, CA 94305", lat: 37.4267, lng: -122.1612,
    capacity: 200, reserved: 15, route: "sal-khan",
    ticketingDate: daysAgo(35), startTimeDate: setTime(daysAgo(7), 18, 30),
    endTimeDate: setTime(daysAgo(7), 20, 0),
    doorsOpen: setTime(daysAgo(7), 17, 45), releaseDate: daysAgo(38),
    live: false, standbyEnabled: true, referralsEnabled: false, hideTicketingDate: false,
    ticketCount: 185, scannedFraction: 0.91, waitlistCount: 45, referralCodeCount: 0,
    ticketTypes: { standard: 170, vip: 15, standby: 0 },
    saleSegments: SALE_SEGMENTS, priority: null,
  },
  {
    name: "Marques Brownlee", title: "The Creator Economy & Tech Reviews",
    tagline: "MKBHD on building authenticity in the digital age",
    desc: "Marques Brownlee (MKBHD) talks about the evolution of tech media, maintaining integrity as a creator, and what makes a great product in 2026.",
    venue: "NVIDIA Auditorium", venueLink: "https://maps.app.goo.gl/stanford-nvidia",
    address: "475 Via Ortega, Stanford, CA 94305", lat: 37.4275, lng: -122.1697,
    capacity: 350, reserved: 25, route: "mkbhd",
    ticketingDate: daysAgo(20), startTimeDate: setTime(daysAgo(1), 19, 0),
    endTimeDate: setTime(daysAgo(1), 20, 30),
    doorsOpen: setTime(daysAgo(1), 18, 0), releaseDate: daysAgo(25),
    live: false, standbyEnabled: true, referralsEnabled: true, hideTicketingDate: false,
    ticketCount: 325, scannedFraction: 0.92, waitlistCount: 60, referralCodeCount: 15,
    ticketTypes: { standard: 290, vip: 25, standby: 10 },
    saleSegments: SALE_SEGMENTS, priority: null,
  },
  {
    name: "Sundar Pichai", title: "AI for Everyone",
    tagline: "Google CEO on democratizing artificial intelligence",
    desc: "Sundar Pichai discusses Google's AI-first strategy, the future of search, and how AI can be made accessible and beneficial for everyone on the planet.",
    venue: "Memorial Auditorium", venueLink: "https://maps.app.goo.gl/stanford-memorial",
    address: "551 Serra Mall, Stanford, CA 94305", lat: 37.4326, lng: -122.1640,
    capacity: 400, reserved: 35, route: "sundar-pichai",
    ticketingDate: daysAgo(10), startTimeDate: setTime(daysFromNow(12), 18, 30),
    endTimeDate: setTime(daysFromNow(12), 20, 0),
    doorsOpen: setTime(daysFromNow(12), 17, 45), releaseDate: daysAgo(14),
    live: false, standbyEnabled: false, referralsEnabled: true, hideTicketingDate: false,
    ticketCount: 240, scannedFraction: 0, waitlistCount: 0, referralCodeCount: 10,
    ticketTypes: { standard: 230, vip: 10, standby: 0 },
    saleSegments: PARTIAL_SALE_SEGMENTS, priority: null,
  },
  {
    name: "Lisa Su", title: "The Semiconductor Revolution",
    tagline: "AMD CEO on chips powering the AI era",
    desc: "Dr. Lisa Su explores how semiconductor innovation drives every major technology trend, from AI training to edge computing, and what the roadmap looks like.",
    venue: "Cemex Auditorium", venueLink: "https://maps.app.goo.gl/stanford-cemex",
    address: "655 Knight Way, Stanford, CA 94305", lat: 37.4300, lng: -122.1660,
    capacity: 300, reserved: 20, route: "lisa-su",
    ticketingDate: daysAgo(2), startTimeDate: setTime(daysFromNow(25), 18, 0),
    endTimeDate: setTime(daysFromNow(25), 19, 30),
    doorsOpen: setTime(daysFromNow(25), 17, 15), releaseDate: daysAgo(5),
    live: false, standbyEnabled: false, referralsEnabled: true, hideTicketingDate: false,
    ticketCount: 65, scannedFraction: 0, waitlistCount: 0, referralCodeCount: 4,
    ticketTypes: { standard: 60, vip: 5, standby: 0 },
    saleSegments: PARTIAL_SALE_SEGMENTS, priority: null,
  },
  {
    name: "Elon Musk", title: "Mars, Machines & the Multi-Planetary Future",
    tagline: "On rockets, robots, and what comes next for humanity",
    desc: "Elon Musk joins Stanford Speakers Bureau for an evening on SpaceX's Mars timeline, Tesla's autonomy push, and why he believes humanity's future is multi-planetary.",
    venue: "Frost Amphitheater", venueLink: "https://maps.app.goo.gl/stanford-frost",
    address: "351 Lasuen St, Stanford, CA 94305", lat: 37.4321, lng: -122.1635,
    capacity: 500, reserved: 50, route: "elon-musk",
    ticketingDate: daysAgo(15), startTimeDate: setTime(daysFromNow(5), 19, 0),
    endTimeDate: setTime(daysFromNow(5), 21, 0),
    doorsOpen: setTime(daysFromNow(5), 18, 0), releaseDate: daysAgo(20),
    live: false, standbyEnabled: true, referralsEnabled: true, hideTicketingDate: false,
    ticketCount: 450, scannedFraction: 0, waitlistCount: 210, referralCodeCount: 25,
    ticketTypes: { standard: 400, vip: 50, standby: 0 },
    saleSegments: SALE_SEGMENTS, priority: null,
  },
  {
    name: "", title: null,
    tagline: "A once-in-a-generation speaker is coming to Stanford",
    desc: "Details coming soon. You won't want to miss this.",
    venue: "Memorial Auditorium", venueLink: "https://maps.app.goo.gl/stanford-memorial",
    address: "551 Serra Mall, Stanford, CA 94305", lat: 37.4326, lng: -122.1640,
    capacity: 400, reserved: 40, route: "mystery-spring-2026",
    ticketingDate: daysFromNow(3), startTimeDate: setTime(daysFromNow(18), 19, 0),
    endTimeDate: setTime(daysFromNow(18), 20, 30),
    doorsOpen: setTime(daysFromNow(18), 18, 0), releaseDate: daysFromNow(2),
    live: false, standbyEnabled: false, referralsEnabled: false, hideTicketingDate: true,
    ticketCount: 0, scannedFraction: 0, waitlistCount: 0, referralCodeCount: 0,
    ticketTypes: { standard: 0, vip: 0, standby: 0 },
    saleSegments: SALE_SEGMENTS, priority: null,
  },
  {
    name: "Brian Chesky", title: "Reinventing Hospitality",
    tagline: "Airbnb CEO on designing experiences, not just stays",
    desc: "Brian Chesky shares the story of Airbnb's reinvention, the future of travel, and why great design thinking can transform any industry.",
    venue: "Dinkelspiel Auditorium", venueLink: "https://maps.app.goo.gl/stanford-dinkelspiel",
    address: "471 Lagunita Dr, Stanford, CA 94305", lat: 37.4267, lng: -122.1612,
    capacity: 200, reserved: 15, route: "brian-chesky",
    ticketingDate: daysFromNow(10), startTimeDate: setTime(daysFromNow(30), 18, 30),
    endTimeDate: setTime(daysFromNow(30), 20, 0),
    doorsOpen: setTime(daysFromNow(30), 17, 45), releaseDate: daysFromNow(8),
    live: false, standbyEnabled: false, referralsEnabled: true, hideTicketingDate: true,
    ticketCount: 0, scannedFraction: 0, waitlistCount: 0, referralCodeCount: 0,
    ticketTypes: { standard: 0, vip: 0, standby: 0 },
    saleSegments: SALE_SEGMENTS, priority: null,
  },
];

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const seed = await createSeedClient();

  console.log("🗑️  Resetting database...");
  await seed.$resetDatabase();

  // Disable triggers that conflict with bulk inserts
  console.log("⏸️  Disabling triggers...");
  await sql`ALTER TABLE public.tickets DISABLE TRIGGER ticket_insert_trigger`;

  // ── Roles ──────────────────────────────────────────────────────────────────
  console.log("👤 Creating admin roles...");
  await seed.roles([
    { email: "anishan@stanford.edu", roles: "admin" },
    { email: "yumich@stanford.edu", roles: "admin" },
  ]);

  // ── Events (structure only, no children) ───────────────────────────────────
  console.log("📅 Creating events...");
  const eventResult = await seed.events(
    EVENT_CONFIGS.map((cfg) => ({
      name: cfg.name as string,
      title: cfg.title,
      tagline: cfg.tagline,
      desc: cfg.desc,
      venue: cfg.venue,
      venue_link: cfg.venueLink,
      address: cfg.address,
      latitude: cfg.lat,
      longitude: cfg.lng,
      capacity: cfg.capacity,
      reserved: cfg.reserved,
      route: cfg.route,
      img: null,
      livestream: null,
      ticketing_date: cfg.ticketingDate.toISOString(),
      start_time_date: cfg.startTimeDate.toISOString(),
      end_time_date: cfg.endTimeDate.toISOString(),
      doors_open: cfg.doorsOpen.toISOString(),
      release_date: cfg.releaseDate.toISOString(),
      live: cfg.live,
      standby_enabled: cfg.standbyEnabled,
      referrals_enabled: cfg.referralsEnabled,
      hide_ticketing_date: cfg.hideTicketingDate,
      waitlist_chance: cfg.standbyEnabled ? "Medium" : "High",
      priority: cfg.priority,
    })),
  );

  const createdEvents = eventResult.events;
  console.log(`   Created ${createdEvents.length} events`);

  // ── Tickets, waitlist, referrals via raw SQL (fast bulk insert) ─────────────
  for (let ei = 0; ei < EVENT_CONFIGS.length; ei++) {
    const cfg = EVENT_CONFIGS[ei];
    const eventId = createdEvents[ei].id as string;
    const eventLabel = cfg.name || "Mystery Speaker";

    if (cfg.ticketCount === 0 && cfg.waitlistCount === 0) {
      console.log(`\n⏭️  ${eventLabel}: no tickets to seed`);
      continue;
    }

    console.log(`\n🎤 ${eventLabel}`);

    const now = new Date();
    const saleEnd =
      cfg.scannedFraction > 0
        ? cfg.startTimeDate
        : new Date(Math.min(now.getTime(), cfg.startTimeDate.getTime()));

    const saleTimestamps = generateTimestamps(
      cfg.ticketCount, cfg.ticketingDate, saleEnd, cfg.saleSegments,
    );

    const scannedCount = Math.round(cfg.ticketCount * cfg.scannedFraction);
    const checkinEnd = new Date(cfg.startTimeDate.getTime() + 60 * 60 * 1000);
    const checkinTimestamps =
      scannedCount > 0
        ? generateTimestamps(scannedCount, cfg.doorsOpen, checkinEnd, CHECKIN_SEGMENTS)
        : [];

    // Shuffled type assignments
    const types: string[] = [];
    for (let i = 0; i < cfg.ticketTypes.vip; i++) types.push("VIP");
    for (let i = 0; i < cfg.ticketTypes.standby; i++) types.push("STANDBY");
    while (types.length < cfg.ticketCount) types.push("STANDARD");
    for (let i = types.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [types[i], types[j]] = [types[j], types[i]];
    }

    // Referral codes
    const refCodes: string[] = [];
    for (let i = 0; i < cfg.referralCodeCount; i++) refCodes.push(referralCode());

    // ── Build ticket rows: shared users + unique users ──────────────────────
    const isPastEvent = cfg.scannedFraction > 0;
    const allTicketRows: Array<{
      event_id: string;
      created_at: string;
      email: string;
      name: string;
      type: string;
      scanned: boolean;
      scan_time: string | null;
      scan_user: string | null;
      scan_email: string | null;
      referral: string | null;
    }> = [];

    // For past events, inject shared users first (they replace some generic slots)
    let sharedUserCount = 0;
    if (isPastEvent) {
      for (const user of SHARED_USERS) {
        if (sharedUserCount >= cfg.ticketCount) break;
        // Use deterministic decision based on user+event so it's stable across runs
        const regRoll = rng();
        if (regRoll > user.registrationRate) continue;

        const showRoll = rng();
        const isScanned = showRoll < user.showUpRate;
        const scanner = pickRandom(SCANNERS);
        const saleIdx = Math.min(sharedUserCount, saleTimestamps.length - 1);
        const checkinIdx = Math.min(sharedUserCount, checkinTimestamps.length - 1);
        const hasRef = rng() < 0.3 && refCodes.length > 0;

        allTicketRows.push({
          event_id: eventId,
          created_at: saleTimestamps[saleIdx].toISOString(),
          email: user.email,
          name: user.name,
          type: user.type,
          scanned: isScanned,
          scan_time: isScanned && checkinTimestamps[checkinIdx] ? checkinTimestamps[checkinIdx].toISOString() : null,
          scan_user: isScanned ? scanner.name : null,
          scan_email: isScanned ? scanner.email : null,
          referral: hasRef ? pickRandom(refCodes) : null,
        });
        sharedUserCount++;
      }
    }

    // Fill remaining slots with unique users
    const uniqueStart = sharedUserCount;
    for (let idx = uniqueStart; idx < cfg.ticketCount; idx++) {
      const seed = `${cfg.route}-t-${idx}`;
      const isScanned = idx < scannedCount;
      const scanner = pickRandom(SCANNERS);
      const hasRef = rng() < 0.3 && refCodes.length > 0;
      allTicketRows.push({
        event_id: eventId,
        created_at: saleTimestamps[idx].toISOString(),
        email: fakeEmail(seed),
        name: fakeName(seed),
        type: types[idx],
        scanned: isScanned,
        scan_time: isScanned ? checkinTimestamps[idx].toISOString() : null,
        scan_user: isScanned ? scanner.name : null,
        scan_email: isScanned ? scanner.email : null,
        referral: hasRef ? pickRandom(refCodes) : null,
      });
    }

    // ── Bulk insert tickets ──────────────────────────────────────────────────
    const BATCH = 200;
    for (let batch = 0; batch < allTicketRows.length; batch += BATCH) {
      const slice = allTicketRows.slice(batch, batch + BATCH);
      await sql`INSERT INTO public.tickets ${sql(slice, "event_id", "created_at", "email", "name", "type", "scanned", "scan_time", "scan_user", "scan_email", "referral")}`;
    }
    console.log(`   🎟️  ${allTicketRows.length} tickets (${sharedUserCount} shared, ${scannedCount} scanned)`);

    // ── Bulk insert waitlist ─────────────────────────────────────────────────
    if (cfg.waitlistCount > 0) {
      const lastSaleTime = saleTimestamps.length > 0
        ? saleTimestamps[saleTimestamps.length - 1].getTime()
        : cfg.ticketingDate.getTime();

      const wlRows = Array.from({ length: cfg.waitlistCount }, (_, idx) => {
        const s = `${cfg.route}-wl-${idx}`;
        const hasRef = rng() < 0.2 && refCodes.length > 0;
        return {
          event_id: eventId,
          email: fakeEmail(s),
          name: fakeName(s),
          position: idx + 1,
          referral: hasRef ? pickRandom(refCodes) : null,
          created_at: new Date(
            lastSaleTime + (idx + 1) * randBetween(30_000, 300_000),
          ).toISOString(),
        };
      });

      for (let batch = 0; batch < wlRows.length; batch += BATCH) {
        const slice = wlRows.slice(batch, batch + BATCH);
        await sql`INSERT INTO public.waitlist ${sql(slice, "event_id", "email", "name", "position", "referral", "created_at")}`;
      }
      console.log(`   📋 ${cfg.waitlistCount} waitlist`);
    }

    // ── Bulk insert referrals ────────────────────────────────────────────────
    if (refCodes.length > 0) {
      const refRows = refCodes.map((code) => ({
        event_id: eventId,
        referral_code: code,
        count: 0,
      }));
      await sql`INSERT INTO public.referrals ${sql(refRows, "event_id", "referral_code", "count")}`;
      console.log(`   🔗 ${refCodes.length} referral codes`);
    }
  }

  // ── Re-enable trigger ──────────────────────────────────────────────────────
  console.log("\n▶️  Re-enabling triggers...");
  await sql`ALTER TABLE public.tickets ENABLE TRIGGER ticket_insert_trigger`;

  // ── Sync denormalized counts ───────────────────────────────────────────────
  console.log("🔄 Syncing counts...");
  await sql`
    UPDATE public.events e SET
      tickets = (SELECT count(*)::int FROM public.tickets t WHERE t.event_id = e.id),
      scanned = (SELECT count(*)::int FROM public.tickets t WHERE t.event_id = e.id AND t.scanned = true),
      scanned_count = (SELECT count(*)::int FROM public.tickets t WHERE t.event_id = e.id AND t.scanned = true)
  `;
  await sql`
    UPDATE public.referrals r SET
      count = (SELECT count(*)::int FROM public.tickets t WHERE t.event_id = r.event_id AND t.referral = r.referral_code)
  `;

  const totalTickets = EVENT_CONFIGS.reduce((s, e) => s + e.ticketCount, 0);
  const totalWaitlist = EVENT_CONFIGS.reduce((s, e) => s + e.waitlistCount, 0);
  const totalScanned = EVENT_CONFIGS.reduce(
    (s, e) => s + Math.round(e.ticketCount * e.scannedFraction), 0,
  );

  console.log("\n✅ Seed complete!");
  console.log(`   ${EVENT_CONFIGS.length} events`);
  console.log(`   ${totalTickets} tickets`);
  console.log(`   ${totalScanned} check-ins`);
  console.log(`   ${totalWaitlist} waitlist entries`);

  await sql.end();
  process.exit(0);
}

main().catch(async (err) => {
  console.error("❌ Seed failed:", err);
  try {
    await sql`ALTER TABLE public.tickets ENABLE TRIGGER ticket_insert_trigger`;
    await sql.end();
  } catch {}
  process.exit(1);
});
