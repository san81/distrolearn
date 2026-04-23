import { useState } from "react";

const COLORS = {
  bg: "#0D0F1A",
  surface: "#151829",
  card: "#1C2040",
  accent: "#6C63FF",
  accentSoft: "#8B85FF",
  accentGlow: "rgba(108,99,255,0.15)",
  green: "#2DD4BF",
  orange: "#F97316",
  red: "#EF4444",
  yellow: "#FBBF24",
  text: "#E8EAFF",
  textMuted: "#6B7280",
  textSub: "#9CA3AF",
  border: "rgba(108,99,255,0.2)",
  borderLight: "rgba(255,255,255,0.07)",
};

const screens = ["onboarding", "home", "flashcard", "puzzle", "viz", "stats", "settings"];

const Badge = ({ children, color = COLORS.accent }) => (
  <span style={{
    background: `${color}22`,
    color: color,
    border: `1px solid ${color}44`,
    borderRadius: 20,
    padding: "2px 10px",
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.5px",
  }}>{children}</span>
);

const PhoneFrame = ({ children, screen, setScreen }) => (
  <div style={{
    width: 375,
    minHeight: 812,
    background: COLORS.bg,
    borderRadius: 44,
    border: `2px solid ${COLORS.border}`,
    overflow: "hidden",
    position: "relative",
    boxShadow: `0 0 60px rgba(108,99,255,0.15), 0 40px 80px rgba(0,0,0,0.5)`,
    fontFamily: "'DM Sans', system-ui, sans-serif",
  }}>
    {/* Status bar */}
    <div style={{ height: 44, background: COLORS.bg, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px" }}>
      <span style={{ color: COLORS.text, fontSize: 12, fontWeight: 600 }}>9:41</span>
      <div style={{ width: 120, height: 6, background: "#1C2040", borderRadius: 20, position: "absolute", left: "50%", transform: "translateX(-50%)" }} />
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <div style={{ width: 16, height: 10, border: `1.5px solid ${COLORS.textMuted}`, borderRadius: 2, position: "relative" }}>
          <div style={{ width: "70%", height: "100%", background: COLORS.green, borderRadius: 1 }} />
        </div>
      </div>
    </div>
    <div style={{ flex: 1 }}>{children}</div>
  </div>
);

const BottomNav = ({ active, setScreen }) => {
  const items = [
    { id: "home", icon: "⌂", label: "Home" },
    { id: "flashcard", icon: "◈", label: "Cards" },
    { id: "puzzle", icon: "⊞", label: "Puzzles" },
    { id: "viz", icon: "⬡", label: "Viz" },
    { id: "stats", icon: "◉", label: "Stats" },
  ];
  return (
    <div style={{
      position: "absolute", bottom: 0, left: 0, right: 0,
      background: COLORS.surface,
      borderTop: `1px solid ${COLORS.borderLight}`,
      display: "flex", padding: "8px 0 20px",
    }}>
      {items.map(it => (
        <button key={it.id} onClick={() => setScreen(it.id)} style={{
          flex: 1, background: "none", border: "none", cursor: "pointer",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
        }}>
          <span style={{ fontSize: 18, filter: active === it.id ? "none" : "grayscale(1) opacity(0.4)" }}>{it.icon}</span>
          <span style={{ fontSize: 10, color: active === it.id ? COLORS.accent : COLORS.textMuted, fontWeight: active === it.id ? 700 : 400 }}>
            {it.label}
          </span>
          {active === it.id && <div style={{ width: 4, height: 4, borderRadius: "50%", background: COLORS.accent, marginTop: 2 }} />}
        </button>
      ))}
    </div>
  );
};

// ─── SCREEN: Onboarding ───────────────────────────────────────────────────────
const OnboardingScreen = ({ setScreen }) => {
  const [step, setStep] = useState(0);
  const [level, setLevel] = useState(null);
  const [topics, setTopics] = useState([]);

  const levels = [
    { id: "novice", label: "Novice", desc: "Just starting out", icon: "🌱" },
    { id: "intermediate", label: "Intermediate", desc: "Some CS background", icon: "🔥" },
    { id: "advanced", label: "Advanced", desc: "Working engineer", icon: "⚡" },
  ];

  const topicList = ["Consensus", "Replication", "Caching", "Queues", "Trees", "Graphs", "Hashing", "Sorting"];

  if (step === 0) return (
    <div style={{ padding: "60px 28px 40px", display: "flex", flexDirection: "column", minHeight: 720 }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 24, textAlign: "center" }}>
        <div style={{
          width: 80, height: 80, borderRadius: 24,
          background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.green})`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 36, boxShadow: `0 0 30px ${COLORS.accentGlow}`,
        }}>⚡</div>
        <div>
          <div style={{ fontSize: 28, fontWeight: 800, color: COLORS.text, letterSpacing: "-0.5px" }}>DistroLearn</div>
          <div style={{ fontSize: 14, color: COLORS.textSub, marginTop: 8, lineHeight: 1.6 }}>Master Distributed Systems &<br />Data Structures through play</div>
        </div>
        <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
          {["Flash Cards", "Puzzles", "Viz Quiz"].map(t => (
            <div key={t} style={{ background: COLORS.card, borderRadius: 12, padding: "10px 14px", border: `1px solid ${COLORS.borderLight}` }}>
              <div style={{ fontSize: 10, color: COLORS.textSub, fontWeight: 600 }}>{t}</div>
            </div>
          ))}
        </div>
      </div>
      <button onClick={() => setStep(1)} style={{
        background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accentSoft})`,
        color: "#fff", border: "none", borderRadius: 16, padding: "16px",
        fontSize: 16, fontWeight: 700, cursor: "pointer", width: "100%",
        boxShadow: `0 8px 24px ${COLORS.accentGlow}`,
      }}>Get Started →</button>
    </div>
  );

  if (step === 1) return (
    <div style={{ padding: "60px 28px 40px", display: "flex", flexDirection: "column", minHeight: 720, gap: 24 }}>
      <div>
        <div style={{ color: COLORS.textMuted, fontSize: 12, fontWeight: 600, letterSpacing: 1, marginBottom: 6 }}>STEP 1 OF 3</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: COLORS.text }}>What's your level?</div>
        <div style={{ fontSize: 13, color: COLORS.textSub, marginTop: 4 }}>We'll calibrate your starting difficulty</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {levels.map(l => (
          <button key={l.id} onClick={() => setLevel(l.id)} style={{
            background: level === l.id ? COLORS.accentGlow : COLORS.card,
            border: `1.5px solid ${level === l.id ? COLORS.accent : COLORS.borderLight}`,
            borderRadius: 16, padding: "16px 20px",
            display: "flex", alignItems: "center", gap: 16, cursor: "pointer",
          }}>
            <span style={{ fontSize: 28 }}>{l.icon}</span>
            <div style={{ textAlign: "left" }}>
              <div style={{ color: COLORS.text, fontWeight: 700, fontSize: 15 }}>{l.label}</div>
              <div style={{ color: COLORS.textSub, fontSize: 12, marginTop: 2 }}>{l.desc}</div>
            </div>
            {level === l.id && <div style={{ marginLeft: "auto", color: COLORS.accent, fontSize: 20 }}>✓</div>}
          </button>
        ))}
      </div>
      <button onClick={() => level && setStep(2)} style={{
        background: level ? `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accentSoft})` : COLORS.card,
        color: level ? "#fff" : COLORS.textMuted, border: "none", borderRadius: 16, padding: "16px",
        fontSize: 15, fontWeight: 700, cursor: level ? "pointer" : "not-allowed", marginTop: "auto",
      }}>Continue →</button>
    </div>
  );

  if (step === 2) return (
    <div style={{ padding: "60px 28px 40px", display: "flex", flexDirection: "column", minHeight: 720, gap: 24 }}>
      <div>
        <div style={{ color: COLORS.textMuted, fontSize: 12, fontWeight: 600, letterSpacing: 1, marginBottom: 6 }}>STEP 2 OF 3</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: COLORS.text }}>Pick your focus</div>
        <div style={{ fontSize: 13, color: COLORS.textSub, marginTop: 4 }}>Select topics to prioritize (choose multiple)</div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        {topicList.map(t => {
          const sel = topics.includes(t);
          return (
            <button key={t} onClick={() => setTopics(prev => sel ? prev.filter(x => x !== t) : [...prev, t])} style={{
              background: sel ? COLORS.accentGlow : COLORS.card,
              border: `1.5px solid ${sel ? COLORS.accent : COLORS.borderLight}`,
              borderRadius: 24, padding: "10px 18px",
              color: sel ? COLORS.accent : COLORS.textSub,
              fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}>{t}</button>
          );
        })}
      </div>
      <div style={{ flex: 1 }} />
      <button onClick={() => setStep(3)} style={{
        background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accentSoft})`,
        color: "#fff", border: "none", borderRadius: 16, padding: "16px",
        fontSize: 15, fontWeight: 700, cursor: "pointer",
      }}>Continue →</button>
    </div>
  );

  return (
    <div style={{ padding: "60px 28px 40px", display: "flex", flexDirection: "column", minHeight: 720, gap: 20, alignItems: "center", justifyContent: "center", textAlign: "center" }}>
      <div style={{ fontSize: 64 }}>🎯</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: COLORS.text }}>You're all set!</div>
      <div style={{ fontSize: 13, color: COLORS.textSub, lineHeight: 1.7 }}>
        Your personalized learning plan is ready.<br />SM-2 algorithm will adapt to your pace.
      </div>
      <div style={{ background: COLORS.card, borderRadius: 16, padding: 20, width: "100%", border: `1px solid ${COLORS.borderLight}`, textAlign: "left" }}>
        <div style={{ color: COLORS.textSub, fontSize: 12, fontWeight: 600, marginBottom: 12 }}>YOUR PLAN</div>
        <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.text, fontSize: 13, marginBottom: 8 }}>
          <span>Starting level</span><Badge>{level || "Novice"}</Badge>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.text, fontSize: 13, marginBottom: 8 }}>
          <span>Daily goal</span><span style={{ color: COLORS.green }}>20 cards + 2 puzzles</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.text, fontSize: 13 }}>
          <span>Topics queued</span><span style={{ color: COLORS.accent }}>{topics.length || 3} focus areas</span>
        </div>
      </div>
      <button onClick={() => setScreen("home")} style={{
        background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accentSoft})`,
        color: "#fff", border: "none", borderRadius: 16, padding: "16px",
        fontSize: 15, fontWeight: 700, cursor: "pointer", width: "100%",
        marginTop: 8, boxShadow: `0 8px 24px ${COLORS.accentGlow}`,
      }}>Start Learning ⚡</button>
    </div>
  );
};

// ─── SCREEN: Home ─────────────────────────────────────────────────────────────
const HomeScreen = ({ setScreen }) => (
  <div style={{ padding: "16px 20px 100px", overflowY: "auto", height: 768 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
      <div>
        <div style={{ color: COLORS.textSub, fontSize: 12 }}>Good morning</div>
        <div style={{ color: COLORS.text, fontSize: 20, fontWeight: 800 }}>Santhosh 👋</div>
      </div>
      <div style={{ width: 40, height: 40, borderRadius: "50%", background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.green})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>S</div>
    </div>

    {/* Streak bar */}
    <div style={{ background: COLORS.card, borderRadius: 16, padding: 16, marginBottom: 16, border: `1px solid ${COLORS.borderLight}`, display: "flex", alignItems: "center", gap: 16 }}>
      <div style={{ fontSize: 32 }}>🔥</div>
      <div>
        <div style={{ color: COLORS.text, fontWeight: 800, fontSize: 18 }}>14-day streak!</div>
        <div style={{ color: COLORS.textSub, fontSize: 12 }}>Keep it going — review 8 cards due today</div>
      </div>
      <div style={{ marginLeft: "auto", background: COLORS.accentGlow, borderRadius: 10, padding: "6px 12px" }}>
        <div style={{ color: COLORS.accent, fontSize: 12, fontWeight: 700 }}>+25 XP</div>
      </div>
    </div>

    {/* Daily missions */}
    <div style={{ marginBottom: 16 }}>
      <div style={{ color: COLORS.textSub, fontSize: 12, fontWeight: 700, letterSpacing: 1, marginBottom: 10 }}>TODAY'S MISSIONS</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {[
          { label: "Review due cards", progress: 5, total: 8, icon: "◈", color: COLORS.accent },
          { label: "Complete Raft consensus puzzle", progress: 0, total: 1, icon: "⊞", color: COLORS.orange },
          { label: "Watch Paxos visualization", progress: 1, total: 1, icon: "⬡", color: COLORS.green },
        ].map((m, i) => (
          <div key={i} style={{ background: COLORS.card, borderRadius: 14, padding: "14px 16px", border: `1px solid ${COLORS.borderLight}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 18 }}>{m.icon}</span>
                <span style={{ color: COLORS.text, fontSize: 13, fontWeight: 600 }}>{m.label}</span>
              </div>
              <span style={{ color: m.color, fontSize: 12, fontWeight: 700 }}>{m.progress}/{m.total}</span>
            </div>
            <div style={{ height: 4, background: "#ffffff10", borderRadius: 4 }}>
              <div style={{ height: 4, width: `${(m.progress / m.total) * 100}%`, background: m.color, borderRadius: 4, transition: "width 0.5s" }} />
            </div>
          </div>
        ))}
      </div>
    </div>

    {/* Quick launch */}
    <div style={{ marginBottom: 16 }}>
      <div style={{ color: COLORS.textSub, fontSize: 12, fontWeight: 700, letterSpacing: 1, marginBottom: 10 }}>QUICK LAUNCH</div>
      <div style={{ display: "flex", gap: 10 }}>
        {[
          { label: "Flash Cards", icon: "◈", color: COLORS.accent, screen: "flashcard" },
          { label: "Puzzles", icon: "⊞", color: COLORS.orange, screen: "puzzle" },
          { label: "Viz Quiz", icon: "⬡", color: COLORS.green, screen: "viz" },
        ].map(item => (
          <button key={item.label} onClick={() => setScreen(item.screen)} style={{
            flex: 1, background: COLORS.card, border: `1px solid ${COLORS.borderLight}`,
            borderRadius: 16, padding: "16px 10px", cursor: "pointer",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
          }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: `${item.color}22`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{item.icon}</div>
            <span style={{ color: COLORS.text, fontSize: 12, fontWeight: 600 }}>{item.label}</span>
          </button>
        ))}
      </div>
    </div>

    {/* Upcoming reviews */}
    <div>
      <div style={{ color: COLORS.textSub, fontSize: 12, fontWeight: 700, letterSpacing: 1, marginBottom: 10 }}>SM-2 REVIEW QUEUE</div>
      {[
        { topic: "Raft Leader Election", next: "Now", difficulty: "Hard" },
        { topic: "B-Tree insertion", next: "Now", difficulty: "Medium" },
        { topic: "Consistent Hashing", next: "Tomorrow", difficulty: "Easy" },
      ].map((c, i) => (
        <div key={i} style={{ background: COLORS.card, borderRadius: 14, padding: "12px 16px", marginBottom: 8, border: `1px solid ${COLORS.borderLight}`, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: c.next === "Now" ? COLORS.accent : COLORS.textMuted, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ color: COLORS.text, fontSize: 13, fontWeight: 600 }}>{c.topic}</div>
            <div style={{ color: COLORS.textSub, fontSize: 11, marginTop: 2 }}>Review: {c.next}</div>
          </div>
          <Badge color={c.difficulty === "Hard" ? COLORS.red : c.difficulty === "Medium" ? COLORS.yellow : COLORS.green}>{c.difficulty}</Badge>
        </div>
      ))}
    </div>
  </div>
);

// ─── SCREEN: Flashcard ────────────────────────────────────────────────────────
const FlashcardScreen = () => {
  const [flipped, setFlipped] = useState(false);
  const [rated, setRated] = useState(null);
  const [cardIdx, setCardIdx] = useState(0);

  const cards = [
    { q: "What problem does the Raft consensus algorithm solve?", a: "Raft solves distributed consensus — ensuring all nodes in a cluster agree on a single value even if some nodes fail. It uses leader election and log replication. A leader is elected from nodes, receives all client writes, replicates the log to followers, and commits once a majority ACKs." },
    { q: "What is consistent hashing used for?", a: "Consistent hashing minimizes key redistribution when nodes are added/removed from a distributed cache or DHT. Only K/n keys (K=keys, n=nodes) need remapping on node changes, vs K keys with modulo hashing." },
  ];

  const card = cards[cardIdx % cards.length];

  const rate = (r) => {
    setRated(r);
    setTimeout(() => { setFlipped(false); setRated(null); setCardIdx(i => i + 1); }, 600);
  };

  return (
    <div style={{ padding: "16px 20px 100px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <div style={{ color: COLORS.text, fontSize: 18, fontWeight: 800 }}>Flash Cards</div>
          <div style={{ color: COLORS.textSub, fontSize: 12 }}>Distributed Systems · Consensus</div>
        </div>
        <Badge color={COLORS.orange}>8 due</Badge>
      </div>

      {/* Progress */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
        {[...Array(8)].map((_, i) => (
          <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i < cardIdx ? COLORS.accent : COLORS.card }} />
        ))}
      </div>

      {/* Card */}
      <div onClick={() => setFlipped(f => !f)} style={{
        background: flipped ? `linear-gradient(135deg, ${COLORS.accentGlow}, ${COLORS.card})` : COLORS.card,
        border: `1.5px solid ${flipped ? COLORS.accent : COLORS.borderLight}`,
        borderRadius: 24, padding: 28, minHeight: 260, cursor: "pointer",
        display: "flex", flexDirection: "column", justifyContent: "space-between",
        transition: "all 0.3s", marginBottom: 20,
        boxShadow: flipped ? `0 0 30px ${COLORS.accentGlow}` : "none",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <Badge color={flipped ? COLORS.green : COLORS.accent}>{flipped ? "ANSWER" : "QUESTION"}</Badge>
          <span style={{ color: COLORS.textMuted, fontSize: 20 }}>⟳</span>
        </div>
        <div style={{ color: COLORS.text, fontSize: 15, lineHeight: 1.7, marginTop: 16 }}>
          {flipped ? card.a : card.q}
        </div>
        {!flipped && (
          <div style={{ color: COLORS.textMuted, fontSize: 12, textAlign: "center", marginTop: 16 }}>Tap to reveal answer</div>
        )}
      </div>

      {/* SM-2 rating */}
      {flipped && !rated && (
        <div>
          <div style={{ color: COLORS.textSub, fontSize: 12, fontWeight: 700, letterSpacing: 1, textAlign: "center", marginBottom: 12 }}>HOW WELL DID YOU RECALL IT?</div>
          <div style={{ display: "flex", gap: 8 }}>
            {[
              { label: "Again", sub: "Forgot", color: COLORS.red, q: 0 },
              { label: "Hard", sub: "Struggled", color: COLORS.orange, q: 2 },
              { label: "Good", sub: "Got it", color: COLORS.accent, q: 4 },
              { label: "Easy", sub: "Perfect", color: COLORS.green, q: 5 },
            ].map(r => (
              <button key={r.label} onClick={() => rate(r.q)} style={{
                flex: 1, background: `${r.color}22`, border: `1.5px solid ${r.color}55`,
                borderRadius: 14, padding: "12px 4px", cursor: "pointer",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
              }}>
                <span style={{ color: r.color, fontSize: 13, fontWeight: 800 }}>{r.label}</span>
                <span style={{ color: COLORS.textMuted, fontSize: 10 }}>{r.sub}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* SM-2 info */}
      <div style={{ background: COLORS.card, borderRadius: 14, padding: 14, marginTop: 16, border: `1px solid ${COLORS.borderLight}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
          <span style={{ color: COLORS.textSub }}>EF (Easiness): <span style={{ color: COLORS.text }}>2.3</span></span>
          <span style={{ color: COLORS.textSub }}>Next review: <span style={{ color: COLORS.green }}>6 days</span></span>
          <span style={{ color: COLORS.textSub }}>Rep #: <span style={{ color: COLORS.text }}>3</span></span>
        </div>
      </div>
    </div>
  );
};

// ─── SCREEN: Puzzle ───────────────────────────────────────────────────────────
const PuzzleScreen = () => {
  const [selected, setSelected] = useState([]);
  const [solved, setSolved] = useState(false);

  const steps = ["Client sends write", "Leader replicates log entry", "Majority ACK received", "Leader commits", "Followers notified"];
  const [order, setOrder] = useState([2, 0, 4, 1, 3]);

  const move = (from, to) => {
    const newOrder = [...order];
    const tmp = newOrder[from]; newOrder[from] = newOrder[to]; newOrder[to] = tmp;
    setOrder(newOrder);
    if (JSON.stringify(newOrder) === JSON.stringify([0, 1, 2, 3, 4])) setSolved(true);
  };

  return (
    <div style={{ padding: "16px 20px 100px" }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ color: COLORS.text, fontSize: 18, fontWeight: 800 }}>Sequence Puzzle</div>
        <div style={{ color: COLORS.textSub, fontSize: 12 }}>Arrange the Raft write flow in correct order</div>
      </div>

      {/* Timer */}
      <div style={{ background: COLORS.card, borderRadius: 14, padding: "12px 16px", marginBottom: 20, border: `1px solid ${COLORS.borderLight}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: COLORS.accent, fontSize: 20 }}>⏱</span>
          <div>
            <div style={{ color: COLORS.text, fontWeight: 700, fontSize: 16 }}>1:47</div>
            <div style={{ color: COLORS.textSub, fontSize: 11 }}>Time remaining</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Badge color={COLORS.yellow}>+50 XP</Badge>
          <Badge color={COLORS.accent}>Intermediate</Badge>
        </div>
      </div>

      {/* Draggable steps */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
        {order.map((idx, pos) => (
          <div key={idx} style={{
            background: solved ? `${COLORS.green}22` : COLORS.card,
            border: `1.5px solid ${solved ? COLORS.green : COLORS.borderLight}`,
            borderRadius: 14, padding: "14px 16px",
            display: "flex", alignItems: "center", gap: 14,
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: solved ? COLORS.green : COLORS.accent,
              color: "#fff", fontSize: 13, fontWeight: 800,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>{pos + 1}</div>
            <span style={{ color: COLORS.text, fontSize: 13, flex: 1 }}>{steps[idx]}</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {pos > 0 && <button onClick={() => move(pos, pos - 1)} style={{ background: "none", border: "none", color: COLORS.textMuted, cursor: "pointer", fontSize: 14 }}>▲</button>}
              {pos < order.length - 1 && <button onClick={() => move(pos, pos + 1)} style={{ background: "none", border: "none", color: COLORS.textMuted, cursor: "pointer", fontSize: 14 }}>▼</button>}
            </div>
          </div>
        ))}
      </div>

      {solved ? (
        <div style={{ background: `${COLORS.green}22`, border: `1.5px solid ${COLORS.green}`, borderRadius: 16, padding: 20, textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🎉</div>
          <div style={{ color: COLORS.green, fontWeight: 800, fontSize: 18 }}>Correct! +50 XP</div>
          <div style={{ color: COLORS.textSub, fontSize: 12, marginTop: 4 }}>Next review: 6 days (SM-2 scheduled)</div>
        </div>
      ) : (
        <div style={{ background: COLORS.card, borderRadius: 14, padding: 14, border: `1px solid ${COLORS.borderLight}` }}>
          <div style={{ color: COLORS.textSub, fontSize: 12 }}>💡 <span style={{ color: COLORS.text }}>Hint:</span> Think about what must happen before a leader can commit a write in a distributed log.</div>
        </div>
      )}

      {/* Other puzzle types */}
      <div style={{ marginTop: 20 }}>
        <div style={{ color: COLORS.textSub, fontSize: 12, fontWeight: 700, letterSpacing: 1, marginBottom: 10 }}>MORE PUZZLE TYPES</div>
        <div style={{ display: "flex", gap: 8 }}>
          {[
            { label: "Pattern Match", icon: "⇄", color: COLORS.accent },
            { label: "Fill-in-Blank", icon: "✏", color: COLORS.orange },
            { label: "Drag & Drop", icon: "⟷", color: COLORS.green },
          ].map(p => (
            <div key={p.label} style={{ flex: 1, background: COLORS.card, borderRadius: 14, padding: "12px 8px", border: `1px solid ${COLORS.borderLight}`, textAlign: "center" }}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>{p.icon}</div>
              <div style={{ color: COLORS.textSub, fontSize: 10, fontWeight: 600 }}>{p.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── SCREEN: Visualization Quiz ───────────────────────────────────────────────
const VizScreen = () => {
  const [phase, setPhase] = useState(0);
  const [ans, setAns] = useState(null);
  const [tick, setTick] = useState(0);

  const nodes = [
    { id: "N1", x: 50, y: 80, role: phase >= 2 ? "leader" : "follower" },
    { id: "N2", x: 200, y: 40, role: "follower" },
    { id: "N3", x: 320, y: 80, role: "follower" },
    { id: "N4", x: 50, y: 180, role: phase >= 1 ? "candidate" : "follower" },
    { id: "N5", x: 200, y: 200, role: "follower" },
  ];

  const nodeColor = (role) => role === "leader" ? COLORS.green : role === "candidate" ? COLORS.orange : COLORS.accent;

  return (
    <div style={{ padding: "16px 20px 100px" }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ color: COLORS.text, fontSize: 18, fontWeight: 800 }}>Visualization Quiz</div>
        <div style={{ color: COLORS.textSub, fontSize: 12 }}>Watch the animation, then answer</div>
      </div>

      <div style={{ background: COLORS.card, borderRadius: 20, padding: 20, marginBottom: 16, border: `1px solid ${COLORS.borderLight}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <Badge color={COLORS.green}>LIVE</Badge>
          <div style={{ color: COLORS.textSub, fontSize: 12 }}>Raft Leader Election</div>
        </div>
        {/* SVG Animation */}
        <svg width="100%" height="240" viewBox="0 0 380 240" style={{ borderRadius: 12, background: "#0D0F1A" }}>
          {/* Edges */}
          {[[0,1],[1,2],[0,3],[3,4],[1,4]].map(([a,b], i) => (
            <line key={i}
              x1={nodes[a].x + 20} y1={nodes[a].y + 20}
              x2={nodes[b].x + 20} y2={nodes[b].y + 20}
              stroke={phase >= 2 ? COLORS.green + "60" : COLORS.accent + "30"} strokeWidth="1.5"
              strokeDasharray={phase >= 2 ? "none" : "4,4"}
            />
          ))}
          {/* Vote arrows in phase 1 */}
          {phase === 1 && [1,2,4].map((ni, i) => (
            <line key={`vote-${i}`}
              x1={nodes[ni].x + 20} y1={nodes[ni].y + 20}
              x2={nodes[3].x + 20} y2={nodes[3].y + 20}
              stroke={COLORS.orange} strokeWidth="1.5" opacity="0.7"
            />
          ))}
          {/* Nodes */}
          {nodes.map((n, i) => (
            <g key={n.id}>
              <circle cx={n.x + 20} cy={n.y + 20} r="22"
                fill={`${nodeColor(n.role)}22`}
                stroke={nodeColor(n.role)} strokeWidth="2"
              />
              {n.role === "leader" && (
                <circle cx={n.x + 20} cy={n.y + 20} r="28"
                  fill="none" stroke={COLORS.green} strokeWidth="1" opacity="0.4" strokeDasharray="3,3"
                />
              )}
              <text x={n.x + 20} y={n.y + 25} textAnchor="middle"
                fill={nodeColor(n.role)} fontSize="11" fontWeight="700">{n.id}</text>
              <text x={n.x + 20} y={n.y + 50} textAnchor="middle"
                fill={nodeColor(n.role)} fontSize="9" opacity="0.8"
              >{n.role === "leader" ? "👑" : n.role === "candidate" ? "✋" : ""}</text>
            </g>
          ))}
          {/* Phase label */}
          <text x="190" y="228" textAnchor="middle" fill={COLORS.textMuted} fontSize="10">
            {["Initial State — Followers awaiting heartbeat",
              "Timeout — N4 starts election, sends vote requests",
              "N4 wins majority → becomes Leader"][phase]}
          </text>
        </svg>
        {/* Phase controls */}
        <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 12 }}>
          {["Init", "Election", "Elected"].map((label, i) => (
            <button key={i} onClick={() => setPhase(i)} style={{
              background: phase === i ? COLORS.accentGlow : "none",
              border: `1px solid ${phase === i ? COLORS.accent : COLORS.borderLight}`,
              borderRadius: 8, padding: "6px 14px", color: phase === i ? COLORS.accent : COLORS.textMuted,
              fontSize: 11, fontWeight: 600, cursor: "pointer",
            }}>{label}</button>
          ))}
        </div>
      </div>

      {/* Question */}
      <div style={{ background: COLORS.card, borderRadius: 16, padding: 18, border: `1px solid ${COLORS.borderLight}`, marginBottom: 12 }}>
        <div style={{ color: COLORS.text, fontSize: 14, fontWeight: 600, marginBottom: 14 }}>
          ⏱ In the Raft election above, N4 wins. What is the minimum number of votes needed (including its own) in a 5-node cluster?
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {["2 votes", "3 votes (majority)", "4 votes", "All 5 votes"].map((opt, i) => (
            <button key={i} onClick={() => setAns(i)} style={{
              background: ans === i ? (i === 1 ? `${COLORS.green}22` : `${COLORS.red}22`) : "none",
              border: `1.5px solid ${ans === i ? (i === 1 ? COLORS.green : COLORS.red) : COLORS.borderLight}`,
              borderRadius: 12, padding: "12px 16px", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 10,
            }}>
              <div style={{ width: 20, height: 20, borderRadius: "50%", border: `2px solid ${ans === i ? (i === 1 ? COLORS.green : COLORS.red) : COLORS.borderLight}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {ans === i && <div style={{ width: 10, height: 10, borderRadius: "50%", background: i === 1 ? COLORS.green : COLORS.red }} />}
              </div>
              <span style={{ color: COLORS.text, fontSize: 13 }}>{opt}</span>
              {ans === i && i === 1 && <span style={{ marginLeft: "auto", color: COLORS.green }}>✓ Correct!</span>}
              {ans === i && i !== 1 && <span style={{ marginLeft: "auto", color: COLORS.red }}>✗</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── SCREEN: Stats ────────────────────────────────────────────────────────────
const StatsScreen = () => {
  const topics = [
    { name: "Consensus", score: 82, color: COLORS.accent },
    { name: "Replication", score: 67, color: COLORS.green },
    { name: "Caching", score: 91, color: COLORS.yellow },
    { name: "B-Trees", score: 55, color: COLORS.orange },
    { name: "Hashing", score: 74, color: COLORS.accentSoft },
  ];
  const weekData = [12, 8, 15, 20, 14, 18, 22];
  const days = ["M", "T", "W", "T", "F", "S", "S"];
  const maxVal = Math.max(...weekData);

  return (
    <div style={{ padding: "16px 20px 100px", overflowY: "auto", height: 768 }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ color: COLORS.text, fontSize: 18, fontWeight: 800 }}>Progress</div>
        <div style={{ color: COLORS.textSub, fontSize: 12 }}>SM-2 adaptive learning stats</div>
      </div>

      {/* XP + level */}
      <div style={{ background: `linear-gradient(135deg, ${COLORS.card}, ${COLORS.accentGlow})`, borderRadius: 20, padding: 20, marginBottom: 16, border: `1px solid ${COLORS.border}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div>
            <div style={{ color: COLORS.textSub, fontSize: 12 }}>Total XP</div>
            <div style={{ color: COLORS.text, fontSize: 28, fontWeight: 900 }}>4,820</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ color: COLORS.accent, fontSize: 13, fontWeight: 700 }}>Level 12</div>
            <div style={{ color: COLORS.textSub, fontSize: 12 }}>180 XP to next</div>
          </div>
        </div>
        <div style={{ height: 6, background: "#ffffff10", borderRadius: 4 }}>
          <div style={{ height: 6, width: "77%", background: `linear-gradient(90deg, ${COLORS.accent}, ${COLORS.green})`, borderRadius: 4 }} />
        </div>
      </div>

      {/* Weekly activity */}
      <div style={{ background: COLORS.card, borderRadius: 16, padding: 16, marginBottom: 16, border: `1px solid ${COLORS.borderLight}` }}>
        <div style={{ color: COLORS.textSub, fontSize: 12, fontWeight: 700, letterSpacing: 1, marginBottom: 14 }}>WEEKLY CARDS REVIEWED</div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 80 }}>
          {weekData.map((v, i) => (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{ flex: 1, display: "flex", alignItems: "flex-end" }}>
                <div style={{
                  width: "100%", background: i === 6 ? COLORS.accent : `${COLORS.accent}40`,
                  borderRadius: "4px 4px 0 0", height: `${(v / maxVal) * 70}px`,
                  minHeight: 4, transition: "height 0.3s",
                }} />
              </div>
              <span style={{ color: COLORS.textMuted, fontSize: 10 }}>{days[i]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Topic mastery */}
      <div style={{ background: COLORS.card, borderRadius: 16, padding: 16, marginBottom: 16, border: `1px solid ${COLORS.borderLight}` }}>
        <div style={{ color: COLORS.textSub, fontSize: 12, fontWeight: 700, letterSpacing: 1, marginBottom: 14 }}>TOPIC MASTERY</div>
        {topics.map(t => (
          <div key={t.name} style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ color: COLORS.text, fontSize: 13 }}>{t.name}</span>
              <span style={{ color: t.color, fontSize: 13, fontWeight: 700 }}>{t.score}%</span>
            </div>
            <div style={{ height: 6, background: "#ffffff10", borderRadius: 4 }}>
              <div style={{ height: 6, width: `${t.score}%`, background: t.color, borderRadius: 4, opacity: 0.85 }} />
            </div>
          </div>
        ))}
      </div>

      {/* SM-2 health */}
      <div style={{ display: "flex", gap: 10 }}>
        {[
          { label: "Cards Due", value: 8, icon: "◈", color: COLORS.orange },
          { label: "Avg EF", value: "2.4", icon: "⚡", color: COLORS.accent },
          { label: "Retention", value: "87%", icon: "◉", color: COLORS.green },
        ].map(s => (
          <div key={s.label} style={{ flex: 1, background: COLORS.card, borderRadius: 14, padding: "14px 10px", border: `1px solid ${COLORS.borderLight}`, textAlign: "center" }}>
            <div style={{ fontSize: 20, marginBottom: 6 }}>{s.icon}</div>
            <div style={{ color: s.color, fontSize: 18, fontWeight: 900 }}>{s.value}</div>
            <div style={{ color: COLORS.textMuted, fontSize: 10, marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState("onboarding");
  const showNav = !["onboarding"].includes(screen);

  const renderScreen = () => {
    switch (screen) {
      case "onboarding": return <OnboardingScreen setScreen={setScreen} />;
      case "home": return <HomeScreen setScreen={setScreen} />;
      case "flashcard": return <FlashcardScreen />;
      case "puzzle": return <PuzzleScreen />;
      case "viz": return <VizScreen />;
      case "stats": return <StatsScreen />;
      default: return <HomeScreen setScreen={setScreen} />;
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#07080F",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "flex-start",
      padding: "32px 16px",
      fontFamily: "'DM Sans', system-ui, sans-serif",
    }}>
      <div style={{ marginBottom: 24, textAlign: "center" }}>
        <div style={{ color: "#6C63FF", fontSize: 13, fontWeight: 700, letterSpacing: 2, marginBottom: 4 }}>DISTROLEARN · WIREFRAME MOCKUP</div>
        <div style={{ color: "#6B7280", fontSize: 12 }}>Interactive prototype — click through all screens</div>
      </div>

      {/* Screen selector */}
      <div style={{ display: "flex", gap: 6, marginBottom: 24, flexWrap: "wrap", justifyContent: "center" }}>
        {[
          { id: "onboarding", label: "Onboarding" },
          { id: "home", label: "Home" },
          { id: "flashcard", label: "Flash Cards" },
          { id: "puzzle", label: "Puzzle" },
          { id: "viz", label: "Viz Quiz" },
          { id: "stats", label: "Progress" },
        ].map(s => (
          <button key={s.id} onClick={() => setScreen(s.id)} style={{
            background: screen === s.id ? COLORS.accentGlow : "#151829",
            border: `1px solid ${screen === s.id ? COLORS.accent : "#ffffff15"}`,
            borderRadius: 20, padding: "6px 14px",
            color: screen === s.id ? COLORS.accent : "#6B7280",
            fontSize: 12, fontWeight: 600, cursor: "pointer",
          }}>{s.label}</button>
        ))}
      </div>

      <PhoneFrame screen={screen} setScreen={setScreen}>
        {renderScreen()}
        {showNav && <BottomNav active={screen} setScreen={setScreen} />}
      </PhoneFrame>

      <div style={{ marginTop: 24, color: "#374151", fontSize: 11, textAlign: "center" }}>
        Tap the phone to interact · Switch screens with buttons above
      </div>
    </div>
  );
}
