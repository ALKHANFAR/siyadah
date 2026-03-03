import { useState, useEffect, useRef } from "react";

const ACCENT = "#C8A44E";
const ACCENT_DIM = "rgba(200,164,78,0.15)";
const BG_PRIMARY = "#0A0B0F";
const BG_SECONDARY = "#12131A";
const BG_CARD = "#1A1B24";
const TEXT_PRIMARY = "#F0ECE3";
const TEXT_DIM = "#8A8693";
const BORDER = "rgba(200,164,78,0.12)";

const DEMO_FLOWS = [
  { id: 1, name: "متابعة العملاء الجدد", status: "active", runs: 342, icon: "👥" },
  { id: 2, name: "تنبيهات الفواتير المتأخرة", status: "active", runs: 89, icon: "📄" },
  { id: 3, name: "تقرير أسبوعي تلقائي", status: "active", runs: 52, icon: "📊" },
  { id: 4, name: "ردود الشكاوى الذكية", status: "paused", runs: 215, icon: "💬" },
  { id: 5, name: "مزامنة جهات الاتصال", status: "active", runs: 1203, icon: "🔄" },
];

const QUICK_ACTIONS = [
  { label: "أنشئ أتمتة جديدة", icon: "⚡" },
  { label: "تقرير اليوم", icon: "📊" },
  { label: "حالة الأنظمة", icon: "🔍" },
  { label: "أدواتي المتصلة", icon: "🔗" },
];

const DEMO_CONVERSATION = [
  {
    role: "assistant",
    content: "أهلاً بك في سيادة 👋\n\nأنا مساعدك الذكي لإدارة الأتمتة. كيف أقدر أخدمك اليوم؟",
    timestamp: "10:00",
  },
];

const SIMULATED_RESPONSES = {
  "أنشئ أتمتة جديدة": [
    {
      role: "assistant",
      content: "ممتاز! وش نوع الأتمتة الي تبيها؟",
      timestamp: "",
      options: [
        "متابعة عملاء",
        "إرسال تنبيهات",
        "تقرير تلقائي",
        "ربط أنظمة",
      ],
    },
  ],
  "تقرير اليوم": [
    {
      role: "assistant",
      content: null,
      timestamp: "",
      report: {
        title: "تقرير اليوم — السبت 28 فبراير",
        stats: [
          { label: "أتمتة نشطة", value: "4", trend: "+1" },
          { label: "عمليات اليوم", value: "47", trend: "+12" },
          { label: "عملاء جدد", value: "8", trend: "+3" },
          { label: "معدل النجاح", value: "98.7%", trend: "+0.3%" },
        ],
        summary:
          "كل الأنظمة شغالة ممتاز. فيه 3 فواتير متأخرة تحتاج متابعة — تبيني أرسل تذكير تلقائي؟",
      },
    },
  ],
  "حالة الأنظمة": [
    {
      role: "assistant",
      content: null,
      timestamp: "",
      systems: [
        { name: "Google Sheets", status: "connected", icon: "📊" },
        { name: "Gmail", status: "connected", icon: "📧" },
        { name: "WhatsApp Business", status: "connected", icon: "💬" },
        { name: "Slack", status: "connected", icon: "💼" },
        { name: "HubSpot", status: "warning", icon: "🔶" },
        { name: "Stripe", status: "connected", icon: "💳" },
      ],
    },
  ],
  "أدواتي المتصلة": [
    {
      role: "assistant",
      content: null,
      timestamp: "",
      tools: true,
    },
  ],
  default: [
    {
      role: "assistant",
      content:
        "فهمتك. خلني أشتغل عليها...\n\n✅ تم — الأتمتة جاهزة وشغالة. تبي تعدّل شي ثاني؟",
      timestamp: "",
    },
  ],
};

function getTime() {
  const d = new Date();
  return d.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function TypingIndicator() {
  return (
    <div style={{ display: "flex", gap: 5, padding: "12px 16px", alignItems: "center" }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: ACCENT,
            opacity: 0.5,
            animation: `typingPulse 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

function MessageBubble({ msg, onOptionClick }) {
  const isUser = msg.role === "user";

  if (msg.report) {
    return (
      <div style={{ maxWidth: "88%", animation: "fadeSlideUp 0.4s ease" }}>
        <div
          style={{
            background: `linear-gradient(135deg, ${BG_CARD} 0%, rgba(200,164,78,0.08) 100%)`,
            borderRadius: 16,
            border: `1px solid ${BORDER}`,
            padding: 20,
            marginBottom: 6,
          }}
        >
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: ACCENT,
              marginBottom: 16,
              fontFamily: "'Noto Kufi Arabic', sans-serif",
            }}
          >
            {msg.report.title}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
            {msg.report.stats.map((s, i) => (
              <div
                key={i}
                style={{
                  background: "rgba(255,255,255,0.03)",
                  borderRadius: 12,
                  padding: "14px 12px",
                  border: `1px solid rgba(255,255,255,0.05)`,
                }}
              >
                <div style={{ fontSize: 11, color: TEXT_DIM, marginBottom: 6 }}>{s.label}</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span style={{ fontSize: 22, fontWeight: 800, color: TEXT_PRIMARY }}>{s.value}</span>
                  <span style={{ fontSize: 11, color: "#5cb85c", fontWeight: 600 }}>{s.trend}</span>
                </div>
              </div>
            ))}
          </div>
          <div
            style={{
              fontSize: 13,
              color: TEXT_DIM,
              lineHeight: 1.8,
              borderTop: `1px solid rgba(255,255,255,0.06)`,
              paddingTop: 12,
            }}
          >
            {msg.report.summary}
          </div>
        </div>
        <div style={{ fontSize: 10, color: TEXT_DIM, paddingRight: 8 }}>{msg.timestamp}</div>
      </div>
    );
  }

  if (msg.systems) {
    return (
      <div style={{ maxWidth: "88%", animation: "fadeSlideUp 0.4s ease" }}>
        <div
          style={{
            background: BG_CARD,
            borderRadius: 16,
            border: `1px solid ${BORDER}`,
            padding: 16,
            marginBottom: 6,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: ACCENT, marginBottom: 14, fontFamily: "'Noto Kufi Arabic', sans-serif" }}>
            حالة الأنظمة المتصلة
          </div>
          {msg.systems.map((sys, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px 0",
                borderBottom: i < msg.systems.length - 1 ? `1px solid rgba(255,255,255,0.04)` : "none",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 18 }}>{sys.icon}</span>
                <span style={{ fontSize: 13, color: TEXT_PRIMARY }}>{sys.name}</span>
              </div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  padding: "4px 10px",
                  borderRadius: 20,
                  background: sys.status === "connected" ? "rgba(92,184,92,0.12)" : "rgba(240,173,78,0.12)",
                  color: sys.status === "connected" ? "#5cb85c" : "#f0ad4e",
                }}
              >
                {sys.status === "connected" ? "متصل" : "يحتاج تحديث"}
              </div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 10, color: TEXT_DIM, paddingRight: 8 }}>{msg.timestamp}</div>
      </div>
    );
  }

  if (msg.tools) {
    const tools = [
      { name: "Google Sheets", actions: 20, icon: "📊", color: "#34A853" },
      { name: "Gmail", actions: 5, icon: "📧", color: "#EA4335" },
      { name: "Slack", actions: 25, icon: "💼", color: "#4A154B" },
      { name: "WhatsApp", actions: 3, icon: "💬", color: "#25D366" },
      { name: "HubSpot", actions: 15, icon: "🟠", color: "#FF7A59" },
      { name: "Stripe", actions: 12, icon: "💳", color: "#635BFF" },
      { name: "OpenAI", actions: 9, icon: "🤖", color: "#10A37F" },
      { name: "Telegram", actions: 6, icon: "📨", color: "#0088cc" },
    ];
    return (
      <div style={{ maxWidth: "88%", animation: "fadeSlideUp 0.4s ease" }}>
        <div
          style={{
            background: BG_CARD,
            borderRadius: 16,
            border: `1px solid ${BORDER}`,
            padding: 16,
            marginBottom: 6,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: ACCENT, marginBottom: 6, fontFamily: "'Noto Kufi Arabic', sans-serif" }}>
            أدواتك المتصلة — 602 أداة متاحة
          </div>
          <div style={{ fontSize: 11, color: TEXT_DIM, marginBottom: 14 }}>
            8 متصلة حالياً من أصل 602 أداة في النظام
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {tools.map((t, i) => (
              <div
                key={i}
                style={{
                  background: "rgba(255,255,255,0.03)",
                  borderRadius: 10,
                  padding: "10px 12px",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  border: `1px solid rgba(255,255,255,0.04)`,
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = `${t.color}44`)}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.04)")}
              >
                <span style={{ fontSize: 20 }}>{t.icon}</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: TEXT_PRIMARY }}>{t.name}</div>
                  <div style={{ fontSize: 10, color: TEXT_DIM }}>{t.actions} إجراء</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ fontSize: 10, color: TEXT_DIM, paddingRight: 8 }}>{msg.timestamp}</div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        justifyContent: isUser ? "flex-start" : "flex-end",
        animation: "fadeSlideUp 0.35s ease",
      }}
    >
      <div style={{ maxWidth: "82%" }}>
        <div
          style={{
            background: isUser
              ? `linear-gradient(135deg, ${ACCENT} 0%, #B8943F 100%)`
              : BG_CARD,
            color: isUser ? "#0A0B0F" : TEXT_PRIMARY,
            borderRadius: isUser ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
            padding: "12px 16px",
            fontSize: 13.5,
            lineHeight: 1.9,
            whiteSpace: "pre-line",
            border: isUser ? "none" : `1px solid ${BORDER}`,
            fontWeight: isUser ? 600 : 400,
          }}
        >
          {msg.content}
        </div>
        {msg.options && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8, justifyContent: "flex-end" }}>
            {msg.options.map((opt, i) => (
              <button
                key={i}
                onClick={() => onOptionClick(opt)}
                style={{
                  background: "transparent",
                  border: `1px solid ${ACCENT}44`,
                  color: ACCENT,
                  borderRadius: 20,
                  padding: "6px 14px",
                  fontSize: 12,
                  cursor: "pointer",
                  fontFamily: "'Noto Kufi Arabic', sans-serif",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = ACCENT_DIM;
                  e.target.style.borderColor = ACCENT;
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = "transparent";
                  e.target.style.borderColor = `${ACCENT}44`;
                }}
              >
                {opt}
              </button>
            ))}
          </div>
        )}
        <div
          style={{
            fontSize: 10,
            color: TEXT_DIM,
            marginTop: 4,
            textAlign: isUser ? "left" : "right",
            paddingLeft: isUser ? 0 : 8,
            paddingRight: isUser ? 8 : 0,
          }}
        >
          {msg.timestamp}
        </div>
      </div>
    </div>
  );
}

function FlowsSidebar({ flows, visible, onClose }) {
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        right: 0,
        width: visible ? 280 : 0,
        height: "100%",
        background: BG_SECONDARY,
        borderLeft: `1px solid ${BORDER}`,
        overflow: "hidden",
        transition: "width 0.35s cubic-bezier(0.4,0,0.2,1)",
        zIndex: 20,
      }}
    >
      <div style={{ padding: 20, width: 280 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: ACCENT, fontFamily: "'Noto Kufi Arabic', sans-serif" }}>
            الأتمتات النشطة
          </span>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: TEXT_DIM,
              fontSize: 20,
              cursor: "pointer",
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>
        {flows.map((f) => (
          <div
            key={f.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 10px",
              borderRadius: 10,
              marginBottom: 4,
              cursor: "pointer",
              transition: "background 0.2s",
              background: "transparent",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <span style={{ fontSize: 22 }}>{f.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: TEXT_PRIMARY,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {f.name}
              </div>
              <div style={{ fontSize: 10, color: TEXT_DIM, marginTop: 2 }}>{f.runs} تشغيل</div>
            </div>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: f.status === "active" ? "#5cb85c" : "#f0ad4e",
                flexShrink: 0,
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SiyadahChat() {
  const [messages, setMessages] = useState(DEMO_CONVERSATION);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [showFlows, setShowFlows] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const chatRef = useRef(null);

  useEffect(() => {
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages, typing]);

  const sendMessage = (text) => {
    if (!text.trim()) return;
    const userMsg = { role: "user", content: text, timestamp: getTime() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setTyping(true);

    const responses = SIMULATED_RESPONSES[text] || SIMULATED_RESPONSES["default"];
    setTimeout(() => {
      setTyping(false);
      const enriched = responses.map((r) => ({ ...r, timestamp: getTime() }));
      setMessages((prev) => [...prev, ...enriched]);
    }, 1200 + Math.random() * 800);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div
      dir="rtl"
      style={{
        width: "100%",
        height: "100vh",
        background: BG_PRIMARY,
        fontFamily: "'Noto Kufi Arabic', 'Segoe UI', sans-serif",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        position: "relative",
        opacity: loaded ? 1 : 0,
        transition: "opacity 0.6s ease",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Kufi+Arabic:wght@300;400;500;600;700;800&display=swap');
        
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes typingPulse {
          0%, 100% { opacity: 0.3; transform: scale(0.85); }
          50% { opacity: 1; transform: scale(1.1); }
        }
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes logoGlow {
          0%, 100% { filter: drop-shadow(0 0 8px rgba(200,164,78,0.2)); }
          50% { filter: drop-shadow(0 0 16px rgba(200,164,78,0.4)); }
        }
        
        *::-webkit-scrollbar { width: 4px; }
        *::-webkit-scrollbar-track { background: transparent; }
        *::-webkit-scrollbar-thumb { background: rgba(200,164,78,0.2); border-radius: 4px; }
        *::-webkit-scrollbar-thumb:hover { background: rgba(200,164,78,0.35); }
        
        input::placeholder { color: #5A5666; }
      `}</style>

      {/* Ambient background */}
      <div
        style={{
          position: "fixed",
          top: -200,
          left: "50%",
          transform: "translateX(-50%)",
          width: 600,
          height: 600,
          borderRadius: "50%",
          background: `radial-gradient(circle, rgba(200,164,78,0.04) 0%, transparent 70%)`,
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 20px",
          borderBottom: `1px solid ${BORDER}`,
          background: `linear-gradient(180deg, rgba(200,164,78,0.04) 0%, transparent 100%)`,
          backdropFilter: "blur(20px)",
          position: "relative",
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: `linear-gradient(135deg, ${ACCENT} 0%, #A07830 100%)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              fontWeight: 800,
              color: BG_PRIMARY,
              fontFamily: "'Noto Kufi Arabic', sans-serif",
              animation: "logoGlow 3s ease-in-out infinite",
            }}
          >
            س
          </div>
          <div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 800,
                color: TEXT_PRIMARY,
                letterSpacing: "-0.02em",
                background: `linear-gradient(90deg, ${TEXT_PRIMARY}, ${ACCENT})`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              سيادة
            </div>
            <div style={{ fontSize: 10, color: TEXT_DIM, marginTop: 1 }}>منصة الأتمتة الذكية</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setShowFlows(!showFlows)}
            style={{
              background: showFlows ? ACCENT_DIM : "rgba(255,255,255,0.04)",
              border: `1px solid ${showFlows ? ACCENT + "44" : "rgba(255,255,255,0.06)"}`,
              color: showFlows ? ACCENT : TEXT_DIM,
              borderRadius: 10,
              padding: "8px 14px",
              fontSize: 12,
              cursor: "pointer",
              fontFamily: "'Noto Kufi Arabic', sans-serif",
              fontWeight: 600,
              transition: "all 0.2s",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span style={{ fontSize: 14 }}>⚡</span>
            أتمتاتي
          </button>
        </div>
      </div>

      {/* Main area */}
      <div style={{ flex: 1, display: "flex", position: "relative", overflow: "hidden" }}>
        {/* Chat area */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          {/* Messages */}
          <div
            ref={chatRef}
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "20px 20px 10px",
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            {messages.map((msg, i) => (
              <MessageBubble key={i} msg={msg} onOptionClick={sendMessage} />
            ))}
            {typing && (
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <div
                  style={{
                    background: BG_CARD,
                    borderRadius: 16,
                    border: `1px solid ${BORDER}`,
                  }}
                >
                  <TypingIndicator />
                </div>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div
            style={{
              padding: "0 20px 8px",
              display: "flex",
              gap: 6,
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            {QUICK_ACTIONS.map((qa, i) => (
              <button
                key={i}
                onClick={() => sendMessage(qa.label)}
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: `1px solid rgba(255,255,255,0.06)`,
                  color: TEXT_DIM,
                  borderRadius: 20,
                  padding: "7px 14px",
                  fontSize: 11.5,
                  cursor: "pointer",
                  fontFamily: "'Noto Kufi Arabic', sans-serif",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  transition: "all 0.25s",
                  fontWeight: 500,
                }}
                onMouseEnter={(e) => {
                  e.target.style.borderColor = `${ACCENT}66`;
                  e.target.style.color = ACCENT;
                  e.target.style.background = ACCENT_DIM;
                }}
                onMouseLeave={(e) => {
                  e.target.style.borderColor = "rgba(255,255,255,0.06)";
                  e.target.style.color = TEXT_DIM;
                  e.target.style.background = "rgba(255,255,255,0.03)";
                }}
              >
                <span style={{ fontSize: 13 }}>{qa.icon}</span>
                {qa.label}
              </button>
            ))}
          </div>

          {/* Input */}
          <div style={{ padding: "8px 16px 16px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: BG_CARD,
                borderRadius: 16,
                border: `1px solid ${BORDER}`,
                padding: "4px 6px 4px 16px",
                transition: "border-color 0.2s",
              }}
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="اكتب أمرك هنا..."
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  color: TEXT_PRIMARY,
                  fontSize: 14,
                  fontFamily: "'Noto Kufi Arabic', sans-serif",
                  padding: "12px 0",
                  direction: "rtl",
                }}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim()}
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  background: input.trim()
                    ? `linear-gradient(135deg, ${ACCENT} 0%, #A07830 100%)`
                    : "rgba(255,255,255,0.04)",
                  border: "none",
                  cursor: input.trim() ? "pointer" : "default",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.25s",
                  transform: "scaleX(-1)",
                  flexShrink: 0,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={input.trim() ? BG_PRIMARY : TEXT_DIM} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>
            <div style={{ textAlign: "center", marginTop: 8, fontSize: 10, color: "rgba(255,255,255,0.15)" }}>
              سيادة v0.1 — مدعوم بـ Activepieces + Groq AI
            </div>
          </div>
        </div>

        {/* Flows Sidebar */}
        <FlowsSidebar flows={DEMO_FLOWS} visible={showFlows} onClose={() => setShowFlows(false)} />
      </div>
    </div>
  );
}
