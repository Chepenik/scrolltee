export const SOCIAL_IMAGE_SIZE = {
  width: 1200,
  height: 630
};

export function ScrollTeeSocialImage() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        background: "linear-gradient(180deg, #78c8f1 0%, #bce8f3 48%, #4fbf75 49%, #19723b 100%)",
        color: "#f8fbf4",
        fontFamily: "Inter, Arial, sans-serif"
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: "300px -120px -190px 470px",
          borderRadius: "100% 0 0 0",
          background: "linear-gradient(135deg, #7ee07f 0%, #d7f1a8 62%, #65c36a 100%)",
          transform: "rotate(-5deg)"
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 640,
          top: 195,
          width: 470,
          height: 245,
          borderRadius: "50%",
          background: "#254f32",
          opacity: 0.18
        }}
      />
      <div
        style={{
          position: "absolute",
          right: 150,
          top: 148,
          width: 12,
          height: 270,
          borderRadius: 12,
          background: "#f8fbf4"
        }}
      />
      <div
        style={{
          position: "absolute",
          right: 42,
          top: 148,
          width: 112,
          height: 72,
          borderRadius: "0 10px 10px 0",
          background: "#ffe08a"
        }}
      />
      <div
        style={{
          position: "absolute",
          right: 170,
          top: 386,
          width: 116,
          height: 34,
          borderRadius: "50%",
          background: "#0d321d",
          opacity: 0.38
        }}
      />
      <div
        style={{
          position: "absolute",
          right: 194,
          top: 346,
          width: 86,
          height: 86,
          borderRadius: "50%",
          background: "#f8fbf4",
          boxShadow: "0 16px 0 rgba(0, 0, 0, 0.16)"
        }}
      />
      <div
        style={{
          position: "absolute",
          right: 218,
          top: 369,
          width: 12,
          height: 12,
          borderRadius: "50%",
          background: "#dfe7dc"
        }}
      />
      <div
        style={{
          position: "absolute",
          right: 250,
          top: 382,
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: "#dfe7dc"
        }}
      />
      <div
        style={{
          position: "absolute",
          right: 204,
          top: 402,
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: "#dfe7dc"
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 88,
          top: 82,
          display: "flex",
          flexDirection: "column",
          gap: 24
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            color: "#12321f",
            fontSize: 34,
            fontWeight: 900,
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
              fontSize: 28
            }}
          >
            ST
          </div>
          Arcade golf
        </div>
        <div
          style={{
            maxWidth: 720,
            display: "flex",
            flexDirection: "column",
            gap: 18
          }}
        >
          <div
            style={{
              color: "#f8fbf4",
              fontSize: 108,
              fontWeight: 950,
              lineHeight: 0.88,
              textTransform: "uppercase",
              textShadow: "0 8px 0 rgba(0, 0, 0, 0.24)"
            }}
          >
            Scroll Tee
          </div>
          <div
            style={{
              maxWidth: 660,
              color: "#12321f",
              fontSize: 35,
              fontWeight: 850,
              lineHeight: 1.14
            }}
          >
            A free browser golf game with scroll-wheel swing timing and quick mobile rounds.
          </div>
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 92,
          bottom: 72,
          display: "flex",
          alignItems: "center",
          gap: 18,
          padding: "16px 24px",
          borderRadius: 14,
          background: "rgba(13, 18, 19, 0.78)",
          border: "2px solid rgba(255, 255, 255, 0.22)",
          color: "#f8fbf4",
          fontSize: 28,
          fontWeight: 850
        }}
      >
        <div
          style={{
            width: 44,
            height: 66,
            borderRadius: 24,
            border: "4px solid #f8fbf4",
            display: "flex",
            justifyContent: "center",
            paddingTop: 10
          }}
        >
          <div
            style={{
              width: 8,
              height: 16,
              borderRadius: 8,
              background: "#ffe08a"
            }}
          />
        </div>
        Scroll down. Rip upward.
      </div>
    </div>
  );
}
