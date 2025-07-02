import { Component, createEffect, createSignal, Show } from "solid-js";

interface TiffPreviewProps {
  data: Uint16Array;
  width: number;
  height: number;
}

const TiffPreview: Component<TiffPreviewProps> = (props) => {
  const [canvasRef, setCanvasRef] = createSignal<HTMLCanvasElement | null>(
    null
  );

  const depthDataToImageData = (
    data: Uint16Array,
    width: number,
    height: number
  ): ImageData => {
    const tempCanvas = document.createElement("canvas");
    const ctx = tempCanvas.getContext("2d")!;
    const imageData = ctx.createImageData(width, height);

    // Find min and max values for normalization
    let min = data[0];
    let max = data[0];
    for (let i = 1; i < data.length; i++) {
      if (data[i] < min) min = data[i];
      if (data[i] > max) max = data[i];
    }

    const range = max - min;

    // Create a colormap for better depth visualization
    const createDepthColormap = (value: number): [number, number, number] => {
      // Normalize to 0-1
      const normalized = range > 0 ? (value - min) / range : 0;

      // Use a blue-to-red colormap for depth visualization
      if (normalized < 0.5) {
        // Blue to cyan
        const t = normalized * 2;
        return [0, Math.floor(t * 255), 255];
      } else {
        // Cyan to red
        const t = (normalized - 0.5) * 2;
        return [
          Math.floor(t * 255),
          Math.floor((1 - t) * 255),
          Math.floor((1 - t) * 255),
        ];
      }
    };

    for (let i = 0; i < data.length; i++) {
      const [r, g, b] = createDepthColormap(data[i]);
      const pixelIndex = i * 4;
      imageData.data[pixelIndex] = r; // R
      imageData.data[pixelIndex + 1] = g; // G
      imageData.data[pixelIndex + 2] = b; // B
      imageData.data[pixelIndex + 3] = 255; // A
    }

    return imageData;
  };

  createEffect(() => {
    const canvas = canvasRef();
    if (canvas && props.data && props.width && props.height) {
      // Set canvas dimensions
      canvas.width = Math.min(props.width, 300); // Limit preview size
      canvas.height = Math.min(props.height, 300);

      const ctx = canvas.getContext("2d")!;
      const imageData = depthDataToImageData(
        props.data,
        props.width,
        props.height
      );

      // Create a temporary canvas to resize the image
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = props.width;
      tempCanvas.height = props.height;
      const tempCtx = tempCanvas.getContext("2d")!;
      tempCtx.putImageData(imageData, 0, 0);

      // Draw resized image to preview canvas
      ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height);
    }
  });

  return (
    <div style={{ margin: "0.5rem 0" }}>
      <canvas
        ref={setCanvasRef}
        style={{
          border: "1px solid #ccc",
          "max-width": "100%",
          height: "auto",
        }}
      />
    </div>
  );
};

export default TiffPreview;
