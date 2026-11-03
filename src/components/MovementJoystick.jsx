import React, { useEffect, useRef, useState } from "react";
import { Gamepad2, Move } from "lucide-react";

const ZERO = Object.freeze({ x: 0, y: 0 });

function JoystickPad({ object, onChange }) {
  const base = useRef(null);
  const pointer = useRef(null);
  const changeRef = useRef(onChange);
  changeRef.current = onChange;
  const [knob, setKnob] = useState({ x: 0, y: 0, active: false });

  function emit(x, y, travel) {
    const length = Math.hypot(x, y);
    if (length > 1) {
      x /= length;
      y /= length;
    }
    const distance = travel || base.current?.clientWidth * 0.29 || 34;
    setKnob({
      x: x * distance,
      y: -y * distance,
      active: Math.hypot(x, y) > 0.06,
    });
    changeRef.current?.(object.id, { x, y });
  }

  function move(event) {
    const rect = base.current?.getBoundingClientRect();
    if (!rect) return;
    const radius = Math.max(1, rect.width * 0.36);
    emit(
      (event.clientX - (rect.left + rect.width / 2)) / radius,
      -(event.clientY - (rect.top + rect.height / 2)) / radius,
      rect.width * 0.29,
    );
  }

  function start(event) {
    if (pointer.current !== null || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    pointer.current = event.pointerId;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is optional on older mobile browsers.
    }
    move(event);
  }

  function drag(event) {
    if (event.pointerId !== pointer.current) return;
    event.preventDefault();
    event.stopPropagation();
    move(event);
  }

  function release(event) {
    if (event && event.pointerId !== pointer.current) return;
    event?.preventDefault();
    event?.stopPropagation();
    pointer.current = null;
    emit(0, 0);
  }

  function keyDirection(event, down) {
    const directions = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, 1],
      ArrowDown: [0, -1],
      a: [-1, 0],
      d: [1, 0],
      w: [0, 1],
      s: [0, -1],
    };
    const direction = directions[event.key];
    if (!direction) return;
    event.preventDefault();
    event.stopPropagation();
    emit(down ? direction[0] : 0, down ? direction[1] : 0);
  }

  return (
    <button
      ref={base}
      type="button"
      className={`joystick-pad ${knob.active ? "active" : ""}`}
      aria-label={`Move ${object.name} with the joystick. Drag, or use arrow keys.`}
      onPointerDown={start}
      onPointerMove={drag}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onKeyDown={(event) => keyDirection(event, true)}
      onKeyUp={(event) => keyDirection(event, false)}
      onBlur={() => release()}
      onContextMenu={(event) => event.preventDefault()}
    >
      <span className="joystick-ring" aria-hidden="true" />
      <span
        className="joystick-knob"
        aria-hidden="true"
        style={{
          transform: `translate(-50%, -50%) translate(${knob.x.toFixed(1)}px, ${knob.y.toFixed(1)}px)`,
        }}
      >
        <Move size={21} strokeWidth={2.2} />
      </span>
    </button>
  );
}

// One pad controls one model at a time. If several objects have joystick
// settings, the small selector chooses the model without stacking controls on
// top of each other on a phone screen.
export default function JoystickDock({
  objects = [],
  onChange,
  className = "",
}) {
  const controls = objects.filter(
    (object) => object.visible !== false && object.joystick,
  );
  const [selectedId, setSelectedId] = useState(null);
  const selected =
    controls.find((object) => object.id === selectedId) || controls[0] || null;
  const objectId = selected?.id || null;
  const changeRef = useRef(onChange);
  changeRef.current = onChange;

  useEffect(() => {
    changeRef.current?.(objectId, ZERO);
    return () => changeRef.current?.(objectId, ZERO);
  }, [objectId]);

  if (!selected) return null;
  return (
    <div className={`joystick-dock ${className}`}>
      <div className="joystick-model">
        <Gamepad2 size={14} aria-hidden="true" />
        {controls.length > 1 ? (
          <select
            aria-label="Model controlled by joystick"
            value={selected.id}
            onChange={(event) => setSelectedId(event.target.value)}
          >
            {controls.map((object) => (
              <option key={object.id} value={object.id}>
                {object.name}
              </option>
            ))}
          </select>
        ) : (
          <span>{selected.name}</span>
        )}
      </div>
      <JoystickPad key={selected.id} object={selected} onChange={onChange} />
      <span className="joystick-caption">DRAG TO MOVE</span>
    </div>
  );
}
