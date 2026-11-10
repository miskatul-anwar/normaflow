import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Send, Sparkles } from "lucide-react";

export function PlaceholdersAndVanishInput({
  placeholders,
  onChange,
  onSubmit,
  inputId,
  ariaLabel,
}: {
  placeholders: string[];
  /** DOM id of the text input (lets a keyboard shortcut focus it). */
  inputId?: string;
  ariaLabel?: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}) {
  const [currentPlaceholder, setCurrentPlaceholder] = useState(0);
  const [value, setValue] = useState("");
  const [animating, setAnimating] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const newDataRef = useRef<any[]>([]);

  const startAnimation = () => {
    intervalRef.current = setInterval(() => {
      setCurrentPlaceholder((prev) => (prev + 1) % placeholders.length);
    }, 3000);
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState !== "visible" && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    } else if (document.visibilityState === "visible") {
      startAnimation();
    }
  };

  useEffect(() => {
    startAnimation();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [placeholders]);

  const draw = useCallback(() => {
    if (!inputRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = 800;
    canvas.height = 800;
    ctx.clearRect(0, 0, 800, 800);

    ctx.font = `32px 'Inter', sans-serif`;
    ctx.fillStyle = "#374151"; // gray-700
    ctx.fillText(value, 16, 40);

    const imageData = ctx.getImageData(0, 0, 800, 800);
    const pixelData = imageData.data;
    const newData: any[] = [];

    for (let t = 0; t < 800; t++) {
      let i = 4 * t * 800;
      for (let n = 0; n < 800; n++) {
        let e = i + 4 * n;
        if (
          pixelData[e] !== 0 &&
          pixelData[e + 1] !== 0 &&
          pixelData[e + 2] !== 0
        ) {
          newData.push({
            x: n,
            y: t,
            color: [
              pixelData[e],
              pixelData[e + 1],
              pixelData[e + 2],
              pixelData[e + 3],
            ],
          });
        }
      }
    }

    newDataRef.current = newData.map(({ x, y, color }) => ({
      x,
      y,
      r: 1,
      color: `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${color[3]})`,
    }));
  }, [value]);

  useEffect(() => {
    draw();
  }, [value, draw]);

  const animate = (start: number) => {
    const animateFrame = (pos: number = 0) => {
      requestAnimationFrame(() => {
        const newArr = [];
        for (let i = 0; i < newDataRef.current.length; i++) {
          const current = newDataRef.current[i];
          if (current.x < pos) {
            newArr.push(current);
          } else {
            if (current.r <= 0) {
              current.r = 0;
              continue;
            }
            current.x += Math.random() > 0.5 ? 1 : -1;
            current.y += Math.random() > 0.5 ? 1 : -1;
            current.r -= 0.05 * Math.random();
            newArr.push(current);
          }
        }
        newDataRef.current = newArr;
        const ctx = canvasRef.current?.getContext("2d");
        if (ctx) {
          ctx.clearRect(pos, 0, 800, 800);
          newDataRef.current.forEach((t) => {
            const { x: n, y: i, r: s, color: color } = t;
            if (n > pos) {
              ctx.beginPath();
              ctx.rect(n, i, s, s);
              ctx.fillStyle = color;
              ctx.strokeStyle = color;
              ctx.stroke();
            }
          });
        }
        if (newDataRef.current.length > 0) {
          animateFrame(pos - 8);
        } else {
          setValue("");
          setAnimating(false);
          setIsTyping(false);
        }
      });
    };
    animateFrame(start);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      // Submit through the form so `onSubmit` runs once. (Starting the animation here
      // first used to flip `animating`, and the form handler then skipped `onSubmit`.)
      e.preventDefault();
      if (!animating && value.trim()) formRef.current?.requestSubmit();
    }
  };

  const vanishAndSubmit = () => {
    setAnimating(true);
    draw();

    const currentValue = inputRef.current?.value || "";
    if (currentValue && inputRef.current) {
      const maxX = newDataRef.current.reduce(
        (prev, current) => (current.x > prev ? current.x : prev),
        0
      );
      animate(maxX);
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (value.trim() && !animating) {
      vanishAndSubmit();
      onSubmit && onSubmit(e);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!animating) {
      setValue(e.target.value);
      setIsTyping(e.target.value.length > 0);
      onChange && onChange(e);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto">
      <form
        ref={formRef}
        className={`relative transition-all duration-300 ${isFocused
          ? "transform scale-[1.02] drop-shadow-lg"
          : "drop-shadow-sm hover:drop-shadow-md"
          }`}
        onSubmit={handleSubmit}
        style={{ fontFamily: "'Inter', sans-serif" }}
      >
        <canvas
          className={`absolute pointer-events-none text-base transform scale-50 top-[20%] left-2 origin-top-left transition-opacity duration-300 ${!animating ? "opacity-0" : "opacity-100"
            }`}
          ref={canvasRef}
        />

        <div className={`flex items-center bg-white rounded-full border-2 transition-all duration-300 ${isFocused
          ? "border-teal-400 shadow-lg bg-gradient-to-r from-teal-50 to-cyan-50"
          : "border-gray-200 shadow-sm hover:border-teal-300 hover:shadow-md hover:bg-gradient-to-r hover:from-teal-50 hover:to-cyan-50"
          }`}>

          {/* Input with modern styling */}
          <div className="flex-1 relative">
            <input
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              ref={inputRef}
              id={inputId}
              aria-label={ariaLabel}
              value={value}
              type="text"
              className={`w-full bg-transparent text-gray-700 h-14 px-6 rounded-l-full focus:outline-none transition-all duration-200 text-base placeholder-transparent ${animating ? "text-transparent" : ""
                }`}
              style={{
                fontFamily: "'Inter', sans-serif",
              }}
              disabled={animating}
            />

            {/* Enhanced placeholder with sparkle effect */}
            {!isTyping && !animating && (
              <div className="absolute inset-0 flex items-center pointer-events-none">
                <div className="pl-6 flex items-center text-gray-500 text-base">
                  <Sparkles className="w-4 h-4 mr-2 text-teal-400 animate-pulse" />
                  <div
                    key={`placeholder-${currentPlaceholder}`}
                    className="transition-all duration-500 ease-in-out"
                    style={{
                      fontFamily: "'Inter', sans-serif",
                      animation: "fadeInOut 3s infinite"
                    }}
                  >
                    {placeholders[currentPlaceholder]}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Exact sidebar-style circular button */}
          <div className="pr-2">
            <button
              disabled={!value.trim() || animating}
              type="submit"
              className={`circular-button sidebar-button w-12 h-12 rounded-full flex items-center justify-center text-gray-700 hover:text-gray-900 shadow-sm hover:shadow-md border border-gray-200 hover:border-gray-300 transition-all duration-300 ${!value.trim() || animating ? "cursor-not-allowed opacity-50" : "bg-white hover:bg-gray-50"
                }`}
              title={animating ? "Processing..." : "Send message"}
              style={{
                background: value.trim() && !animating
                  ? "linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)"
                  : undefined,
                position: "relative",
                overflow: "hidden"
              }}
            >
              {animating ? (
                <Loader2 className="w-5 h-5 animate-spin sidebar-icon" style={{ color: "#14b8a6" }} />
              ) : (
                <Send className={`sidebar-icon transition-transform duration-200 ${value.trim() ? "translate-x-0.5" : ""
                  }`} />
              )}

              {/* Teal gradient overlay for active state */}
              {value.trim() && !animating && (
                <div
                  className="absolute inset-0 rounded-full opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                  style={{
                    background: "radial-gradient(circle at center, rgba(20, 184, 166, 0.15) 0%, transparent 70%)"
                  }}
                />
              )}
            </button>
          </div>
        </div>

        {/* Status indicator above input box */}
        {animating && (
          <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 flex items-center text-sm text-gray-600 z-20">
            <div className="flex items-center space-x-2 bg-white px-3 py-1 rounded-full shadow-md border border-teal-200">
              <div className="w-2 h-2 bg-gradient-to-r from-teal-400 to-cyan-400 rounded-full animate-pulse"></div>
              <span style={{ fontFamily: "'Inter', sans-serif" }}>
                Processing request...
              </span>
            </div>
          </div>
        )}
      </form>

      {/* Custom CSS matching sidebar styles */}
      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes fadeInOut {
            0%, 100% { opacity: 0.7; transform: translateY(0px); }
            50% { opacity: 1; transform: translateY(-2px); }
          }
          
          /* Exact sidebar button styling */
          .circular-button {
            position: relative;
            overflow: hidden;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            background: linear-gradient(145deg, #ffffff 0%, #f8fafc 100%);
            border: 2px solid #e2e8f0;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
            border-radius: 50%;
          }
          
          .circular-button::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: radial-gradient(circle at center, rgba(20, 184, 166, 0.15) 0%, transparent 70%);
            opacity: 0;
            transition: opacity 0.3s ease;
            pointer-events: none;
            border-radius: 50%;
          }
          
          .circular-button:hover::before {
            opacity: 1;
          }
          
          .circular-button:hover {
            transform: translateY(-3px) scale(1.05);
            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
            border-color: #14b8a6;
            background: linear-gradient(145deg, #ffffff 0%, #f0fdfa 100%);
          }
          
          .circular-button:active {
            transform: translateY(-1px) scale(1.02);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          }
          
          .sidebar-icon {
            width: 20px;
            height: 20px;
            flex-shrink: 0;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            color: #64748b;
          }
          
          .circular-button:hover .sidebar-icon {
            transform: scale(1.2) rotate(5deg);
            color: #14b8a6;
          }
          
          .circular-button:disabled {
            transform: none !important;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06) !important;
            border-color: #e2e8f0 !important;
            background: linear-gradient(145deg, #ffffff 0%, #f8fafc 100%) !important;
          }
          
          .circular-button:disabled::before {
            opacity: 0 !important;
          }
          
          .circular-button:disabled .sidebar-icon {
            transform: none !important;
            color: #64748b !important;
          }
        `
      }} />
    </div>
  );
}