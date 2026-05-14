export const SOCIAL_IMAGE_SIZE = {
  width: 1200,
  height: 630
};

const PLAYER_COLORS = ["#6ff3a8", "#69d2ff", "#ffd166", "#ff795d"];

function TurfStripe({ left, top, width, rotate }: { left: number; top: number; width: number; rotate: number }) {
  return (
    <div
      style={{
        position: "absolute",
        left,
        top,
        width,
        height: 18,
        borderRadius: 999,
        background: "rgba(255, 255, 255, 0.16)",
        transform: `rotate(${rotate}deg)`
      }}
    />
  );
}

function ShotTrail({ left, top, size, color }: { left: number; top: number; size: number; color: string }) {
  return (
    <div
      style={{
        position: "absolute",
        left,
        top,
        width: size,
        height: size,
        borderRadius: "50%",
        background: color,
        opacity: 0.8,
        boxShadow: `0 0 ${size * 1.6}px ${color}`
      }}
    />
  );
}

function BallDimple({ left, top, size }: { left: number; top: number; size: number }) {
  return (
    <div
      style={{
        position: "absolute",
        left,
        top,
        width: size,
        height: size,
        borderRadius: "50%",
        background: "rgba(64, 82, 78, 0.16)"
      }}
    />
  );
}

export function ScrollTeeSocialImage() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        background:
          "linear-gradient(180deg, #75c8ee 0%, #a8def1 38%, #72c770 39%, #2b8b48 70%, #10291d 100%)",
        color: "#f8fbf4",
        fontFamily: "Inter, Arial, sans-serif"
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: "0 0 auto 0",
          height: 342,
          background:
            "radial-gradient(circle at 72% 18%, rgba(255, 224, 138, 0.62), rgba(255, 224, 138, 0) 16%), linear-gradient(180deg, rgba(255,255,255,0.18), rgba(255,255,255,0))"
        }}
      />
      <div
        style={{
          position: "absolute",
          left: -160,
          top: 308,
          width: 1540,
          height: 420,
          borderRadius: "50% 50% 0 0",
          background: "linear-gradient(120deg, #1d5f35 0%, #4eb85d 36%, #a6e176 60%, #245c34 100%)",
          transform: "rotate(-4deg)"
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 420,
          top: 275,
          width: 630,
          height: 440,
          borderRadius: "48% 48% 18% 18%",
          background: "linear-gradient(135deg, #d8f6a8 0%, #9ce06e 44%, #50b85d 100%)",
          transform: "rotate(-7deg) skewX(-12deg)"
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 538,
          top: 214,
          width: 430,
          height: 84,
          borderRadius: "50%",
          background: "rgba(40, 88, 55, 0.28)"
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 640,
          top: 232,
          width: 232,
          height: 58,
          borderRadius: "50%",
          background: "linear-gradient(90deg, #dffbba, #8fd972)"
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 710,
          top: 252,
          width: 88,
          height: 20,
          borderRadius: "50%",
          background: "#10281b",
          opacity: 0.52
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 748,
          top: 82,
          width: 10,
          height: 184,
          borderRadius: 999,
          background: "#f8fbf4",
          boxShadow: "0 5px 16px rgba(0,0,0,0.26)"
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 758,
          top: 82,
          width: 126,
          height: 66,
          borderRadius: "0 12px 12px 0",
          background: "linear-gradient(135deg, #ff795d, #ffd166)",
          boxShadow: "0 14px 28px rgba(0,0,0,0.22)"
        }}
      />
      <div
        style={{
          position: "absolute",
          right: 38,
          top: 48,
          width: 472,
          height: 520,
          borderRadius: 42,
          background: "rgba(7, 17, 16, 0.5)",
          transform: "rotate(-8deg)"
        }}
      />
      <div
        style={{
          position: "absolute",
          right: -20,
          bottom: -26,
          width: 360,
          height: 360,
          borderRadius: "50%",
          display: "flex",
          background:
            "radial-gradient(circle at 34% 28%, #ffffff 0%, #f8fbf4 28%, #dce8e2 64%, #aebfb7 100%)",
          boxShadow: "0 36px 0 rgba(0,0,0,0.18)"
        }}
      >
        <BallDimple left={118} top={88} size={22} />
        <BallDimple left={168} top={70} size={18} />
        <BallDimple left={214} top={106} size={20} />
        <BallDimple left={96} top={154} size={18} />
        <BallDimple left={158} top={152} size={21} />
        <BallDimple left={232} top={176} size={17} />
        <BallDimple left={132} top={220} size={16} />
        <BallDimple left={202} top={242} size={20} />
      </div>
      <div
        style={{
          position: "absolute",
          right: 300,
          bottom: 66,
          width: 210,
          height: 18,
          borderRadius: 999,
          background: "#15211f",
          transform: "rotate(-23deg)",
          boxShadow: "0 14px 0 rgba(0,0,0,0.15)"
        }}
      />
      <div
        style={{
          position: "absolute",
          right: 466,
          bottom: 156,
          width: 15,
          height: 266,
          borderRadius: 999,
          background: "linear-gradient(180deg, #e8f1ed, #92a9a0)",
          transform: "rotate(-23deg)",
          transformOrigin: "bottom center"
        }}
      />
      <div
        style={{
          position: "absolute",
          right: 412,
          bottom: 111,
          width: 120,
          height: 42,
          borderRadius: "26px 38px 18px 26px",
          background: "linear-gradient(135deg, #243d48, #6ff3a8 44%, #d8e6e1 45%, #708983 100%)",
          transform: "rotate(-15deg)",
          boxShadow: "0 18px 0 rgba(0,0,0,0.18)"
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 432,
          top: 376,
          width: 390,
          height: 5,
          borderRadius: 999,
          background: "rgba(248, 251, 244, 0.84)",
          transform: "rotate(-28deg)"
        }}
      />
      <ShotTrail left={448} top={328} size={16} color="#6ff3a8" />
      <ShotTrail left={508} top={292} size={18} color="#69d2ff" />
      <ShotTrail left={574} top={256} size={14} color="#ffd166" />
      <ShotTrail left={636} top={224} size={11} color="#f8fbf4" />
      <TurfStripe left={460} top={444} width={134} rotate={-12} />
      <TurfStripe left={590} top={398} width={180} rotate={-8} />
      <TurfStripe left={736} top={350} width={112} rotate={-6} />
      <TurfStripe left={320} top={512} width={150} rotate={8} />
      <div
        style={{
          position: "absolute",
          left: 74,
          top: 72,
          display: "flex",
          flexDirection: "column",
          gap: 18
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            color: "#12321f",
            fontSize: 30,
            fontWeight: 950,
            letterSpacing: 4,
            textTransform: "uppercase"
          }}
        >
          <div
            style={{
              width: 58,
              height: 58,
              borderRadius: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#12321f",
              color: "#ffe08a",
              fontSize: 28,
              boxShadow: "0 14px 26px rgba(0,0,0,0.18)"
            }}
          >
            ST
          </div>
          Original arcade golf
        </div>
        <div
          style={{
            width: 690,
            display: "flex",
            flexDirection: "column",
            gap: 16
          }}
        >
          <div
            style={{
              color: "#f8fbf4",
              fontSize: 118,
              fontWeight: 950,
              lineHeight: 0.82,
              letterSpacing: -1,
              textTransform: "uppercase",
              textShadow: "0 9px 0 rgba(0, 0, 0, 0.3)"
            }}
          >
            Scroll Tee
          </div>
          <div
            style={{
              width: 620,
              color: "#102117",
              fontSize: 34,
              fontWeight: 900,
              lineHeight: 1.08
            }}
          >
            Mouse-wheel swing timing, fast local multiplayer, and ridiculous office-course shots.
          </div>
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 78,
          bottom: 66,
          display: "flex",
          alignItems: "center",
          gap: 18,
          padding: "17px 24px",
          borderRadius: 16,
          background: "rgba(7, 17, 16, 0.82)",
          border: "2px solid rgba(248, 251, 244, 0.24)",
          color: "#f8fbf4",
          fontSize: 27,
          fontWeight: 900,
          boxShadow: "0 22px 46px rgba(0,0,0,0.24)"
        }}
      >
        <div
          style={{
            width: 48,
            height: 70,
            borderRadius: 26,
            border: "4px solid #f8fbf4",
            display: "flex",
            justifyContent: "center",
            paddingTop: 10
          }}
        >
          <div
            style={{
              width: 8,
              height: 18,
              borderRadius: 8,
              background: "#ffe08a"
            }}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span>Scroll down. Rip upward.</span>
          <span style={{ color: "#bfe9cc", fontSize: 19, fontWeight: 850 }}>1-4 players · 18 holes · free in-browser</span>
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          right: 66,
          top: 62,
          display: "flex",
          gap: 10
        }}
      >
        {PLAYER_COLORS.map((color, index) => (
          <div
            key={color}
            style={{
              width: 42,
              height: 42,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: color,
              color: "#102117",
              fontSize: 20,
              fontWeight: 950,
              boxShadow: "0 10px 22px rgba(0,0,0,0.2)"
            }}
          >
            {index + 1}
          </div>
        ))}
      </div>
    </div>
  );
}
