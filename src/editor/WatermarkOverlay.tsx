import { useEffect, useRef, useState } from "react";
import { Group, Image as KonvaImage, Layer, Line, Stage, Text, Transformer } from "react-konva";
import type Konva from "konva";
import type { WatermarkInstance } from "../types";
import { editorPointToNormalized } from "../utils/coordinates";
import { clamp } from "../utils/coordinates";
import { buildTemplatePlan } from "../templates/plan";
import { rasterizeSignatureSvg } from "../signatures/rasterizeSignature";

interface Props {
  width: number;
  height: number;
  watermark: WatermarkInstance;
  signatureSvg: string | null;
  onTransform: (patch: Partial<WatermarkInstance["transform"]>) => void;
  onUndo: () => void;
  onRedo: () => void;
}

function useSvgImage(svg: string | null, color: string | undefined): HTMLCanvasElement | null {
  const [image, setImage] = useState<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (!svg) { setImage(null); return; }
    let alive = true;
    rasterizeSignatureSvg(svg, color).then((canvas) => { if (alive) setImage(canvas); }).catch(() => { if (alive) setImage(null); });
    return () => { alive = false; };
  }, [svg, color]);
  return image;
}

export function WatermarkOverlay({ width, height, watermark, signatureSvg, onTransform, onUndo, onRedo }: Props) {
  const groupRef = useRef<Konva.Group>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const [selected, setSelected] = useState(true);
  const [dragging, setDragging] = useState(false);
  const plan = buildTemplatePlan(watermark);
  const renderedWidth = watermark.transform.width * width;
  const scale = renderedWidth / plan.width;
  const signature = useSvgImage(signatureSvg, undefined);

  useEffect(() => {
    if (selected && groupRef.current && transformerRef.current) {
      transformerRef.current.nodes([groupRef.current]);
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [selected, width, height, watermark.templateId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!selected || ["INPUT", "TEXTAREA", "SELECT"].includes((event.target as HTMLElement)?.tagName)) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") { event.preventDefault(); event.shiftKey ? onRedo() : onUndo(); return; }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") { event.preventDefault(); onRedo(); return; }
      if (event.key === "Escape") { setSelected(false); return; }
      const amount = event.shiftKey ? 0.015 : 0.003;
      const offset: Record<string, [number, number]> = { ArrowLeft: [-amount, 0], ArrowRight: [amount, 0], ArrowUp: [0, -amount], ArrowDown: [0, amount] };
      if (offset[event.key]) {
        event.preventDefault();
        const [x, y] = offset[event.key];
        onTransform({ x: clamp(watermark.transform.x + x, 0, 1), y: clamp(watermark.transform.y + y, 0, 1) });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selected, watermark.transform.x, watermark.transform.y, onTransform, onUndo, onRedo]);

  const saveDrag = () => {
    const node = groupRef.current;
    if (!node) return;
    const center = editorPointToNormalized(node.x(), node.y(), { width, height });
    onTransform(center);
  };
  const saveTransform = () => {
    const node = groupRef.current;
    if (!node) return;
    const nextWidth = clamp((plan.width * node.scaleX()) / width, 0.12, 1.25);
    const center = editorPointToNormalized(node.x(), node.y(), { width, height });
    onTransform({ ...center, width: nextWidth, rotation: node.rotation() });
  };

  return <Stage width={width} height={height} onMouseDown={(event) => { if (event.target === event.target.getStage()) setSelected(false); }} aria-label="Editable certification watermark">
    <Layer>
      {dragging && <>
        <Line points={[width / 2, 0, width / 2, height]} stroke="#0f6cbd" dash={[5, 5]} opacity={0.7} />
        <Line points={[0, height / 2, width, height / 2]} stroke="#0f6cbd" dash={[5, 5]} opacity={0.7} />
      </>}
      <Group
        ref={groupRef}
        x={watermark.transform.x * width}
        y={watermark.transform.y * height}
        width={plan.width}
        height={plan.height}
        offsetX={plan.width / 2}
        offsetY={plan.height / 2}
        scaleX={scale}
        scaleY={scale}
        rotation={watermark.transform.rotation}
        opacity={watermark.style.opacity}
        draggable
        onClick={() => setSelected(true)}
        onTap={() => setSelected(true)}
        onDragStart={() => setDragging(true)}
        onDragEnd={() => { setDragging(false); saveDrag(); }}
        onTransformEnd={saveTransform}
        dragBoundFunc={(position) => ({
          x: Math.abs(position.x - width / 2) < 9 ? width / 2 : clamp(position.x, -width * 0.15, width * 1.15),
          y: Math.abs(position.y - height / 2) < 9 ? height / 2 : clamp(position.y, -height * 0.15, height * 1.15)
        })}
      >
        {plan.elements.map((element, index) => {
          if (element.kind === "line") return <Line key={index} points={[element.x1, element.y1, element.x2, element.y2]} stroke={watermark.style.lineColor} strokeWidth={element.strokeWidth} />;
          if (element.kind === "text") return <Text key={index} text={element.text} x={element.x} y={element.y} offsetY={element.fontSize / 2} align={element.align} offsetX={element.align === "center" ? 500 : 0} width={element.align === "center" ? 1000 : undefined} fontSize={element.fontSize} fontStyle={element.weight === "bold" ? "bold" : "normal"} fill={watermark.style.textColor} fontFamily="TH Sarabun New, Noto Sans Thai, Segoe UI" />;
          if (signature) return <KonvaImage key={index} image={signature} x={element.x} y={element.y} width={element.width} height={element.height} />;
          return null;
        })}
      </Group>
      {selected && <Transformer ref={transformerRef} keepRatio enabledAnchors={["top-left", "top-right", "bottom-left", "bottom-right"]} rotateEnabled borderStroke="#0f6cbd" anchorStroke="#0f6cbd" anchorFill="#fff" boundBoxFunc={(_oldBox, newBox) => newBox.width < 80 || newBox.height < 50 ? _oldBox : newBox} />}
    </Layer>
  </Stage>;
}
