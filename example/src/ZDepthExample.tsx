import { Component, createEffect, createSignal, Show } from "solid-js";
import { useZDepth } from "./useZDepth";
import * as UTIF from "utif";
import TiffPreview from "./TiffPreview";

const ZDepthExample: Component = () => {
  const [depthData, setDepthData] = createSignal<{
    width: number;
    height: number;
    data: Uint16Array;
  } | null>(null);
  const [compressedData, setCompressedData] = createSignal<Uint8Array | null>(
    null
  );
  const [decompressedData, setDecompressedData] = createSignal<{
    width: number;
    height: number;
    data: Uint16Array;
  } | null>(null);
  const [keyframe, setKeyframe] = createSignal(true);
  const [activeTab, setActiveTab] = createSignal<"compress" | "decompress">(
    "compress"
  );
  const zdepth = useZDepth();

  createEffect(() => console.log(zdepth.initialize()));

  const parseTIFF = async (arrayBuffer: ArrayBuffer) => {
    const ifds = UTIF.decode(arrayBuffer);
    if (ifds.length === 0) {
      throw new Error("No valid TIFF data found in the file.");
    }
    const ifd: any = ifds[0];
    console.log("TIFF IFD decoded by UTIF:", ifd);

    const rawWidth = ifd.t256?.[0]; // Tag 256: ImageWidth
    const rawHeight = ifd.t257?.[0]; // Tag 257: ImageLength (Height)
    const rawBitsPerSample = ifd.t258?.[0]; // Tag 258: BitsPerSample
    const rawSamplesPerPixel = ifd.t277?.[0]; // Tag 277: SamplesPerPixel
    console.log(ifd);
    if (
      rawWidth === undefined ||
      rawHeight === undefined ||
      rawBitsPerSample === undefined ||
      rawSamplesPerPixel === undefined
    ) {
      console.error(
        "TIFF IFD missing essential metadata (ImageWidth, ImageLength, BitsPerSample, or SamplesPerPixel). IFD object:",
        ifd
      );
      throw new Error(
        `Invalid TIFF format: Essential metadata missing in the TIFF header. ` +
          `Detected: Width=${rawWidth}, Height=${rawHeight}, BPS=${rawBitsPerSample}, SPP=${rawSamplesPerPixel}.`
      );
    }

    UTIF.decodeImage(arrayBuffer, ifd);
    if (rawBitsPerSample === 16 && rawSamplesPerPixel === 1) {
      if (!ifd.data || !(ifd.data instanceof Uint8Array)) {
        throw new Error(
          "Raw 16-bit image data (ifd.data) not found or invalid after decoding TIFF image."
        );
      }

      const depthData = new Uint16Array(ifd.data.buffer);
      console.log(
        `[parseTIFF] Directly extracted 16-bit grayscale data. Dimensions: ${rawWidth}x${rawHeight}, Length: ${depthData.length}`
      );
      return { width: rawWidth, height: rawHeight, data: depthData };
    } else {
      throw new Error(
        `Unsupported TIFF format for Zdepth. Expected 16-bit grayscale (BitsPerSample: 16, SamplesPerPixel: 1), ` +
          `but got ${rawBitsPerSample}-bit with ${rawSamplesPerPixel} samples. ` +
          `Conversion to this exact format is required before passing to Zdepth.`
      );
    }
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = async (event: Event, isCompressed = false) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    try {
      const arrayBuffer = await file.arrayBuffer();

      if (isCompressed) {
        const compressed = new Uint8Array(arrayBuffer);
        setCompressedData(compressed);
        setDepthData(null);
        setDecompressedData(null);
        const decompressed = await zdepth.decompress(compressed);
        console.log(`Size uncompressed: ${decompressed.data.length * 2} bytes`);
        setDecompressedData(decompressed);
      } else {
        const isTiff =
          file.name.toLowerCase().endsWith(".tiff") ||
          file.name.toLowerCase().endsWith(".tif");

        if (!isTiff) {
          throw new Error("File is not a TIFF file");
        }
        const data = await parseTIFF(arrayBuffer);
        setDepthData(data);
        setCompressedData(null);
        setDecompressedData(null);
      }
    } catch (error) {
      console.error("File upload failed:", error);
      alert(
        `File upload failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  };

  const handleCompress = async () => {
    const depthDataExtracted = depthData();
    if (!depthDataExtracted) return;
    try {
      const { width, height, data } = depthDataExtracted;
      console.log(`Size uncompressed: ${data.length * 2} bytes`);
      const compressed = await zdepth.compress(width, height, data, keyframe());
      setCompressedData(compressed);
      console.log(`Size compressed: ${compressed.length} bytes`);
      const decompressed = await zdepth.decompress(compressed);
      console.log(`Size uncompressed: ${decompressed.data.length * 2} bytes`);
      setDecompressedData(decompressed);
    } catch (error) {
      console.error("Compression failed:", error);
    }
  };

  const downloadDecompressedAsTIFF = () => {
    const data = decompressedData();

    if (!data) {
      console.warn("No decompressed data available to download.");
      return;
    }

    const { width, height, data: pixelData } = data;
    const pixelDataUint8 = new Uint8Array(
      pixelData.buffer,
      pixelData.byteOffset,
      pixelData.byteLength
    );

    // Prepare minimal IFD object for UTIF.js (no 'data' property, no encodeImage call)
    const ifdObject: any = {
      t256: [width], // ImageWidth
      t257: [height], // ImageLength
      t258: [16], // BitsPerSample
      t259: [1], // Compression (no compression)
      t262: [1], // PhotometricInterpretation (black is zero)
      t273: [0], // StripOffsets (start at 0)
      t277: [1], // SamplesPerPixel
      t278: [height], // RowsPerStrip
      t279: [pixelDataUint8.length], // StripByteCounts
      t284: [1],
    };

    const tiffHeader = UTIF.encode([ifdObject]);
    console.log("TIFF header:", tiffHeader);
    if (!tiffHeader || !(tiffHeader instanceof ArrayBuffer)) {
      console.error("UTIF.encode failed to return a valid TIFF buffer.");
      return;
    }

    const tiffHeaderUint8 = new Uint8Array(tiffHeader);

    // Concatenate the header and the pixel data
    const tiffBuffer = new Uint8Array(
      tiffHeaderUint8.length + pixelDataUint8.length
    );
    tiffBuffer.set(tiffHeaderUint8, 0);
    tiffBuffer.set(pixelDataUint8, tiffHeaderUint8.length);

    const blob = new Blob([tiffBuffer], { type: "image/tiff" });
    downloadBlob(blob, "decompressed.tiff");
    console.log(
      `TIFF download initiated for ${width}x${height} (16-bit grayscale) image.`
    );
  };

  // Reset state when switching tabs
  const handleTabChange = (tab: "compress" | "decompress") => {
    setActiveTab(tab);
    setDepthData(null);
    setCompressedData(null);
    setDecompressedData(null);
  };

  return (
    <div style={{ padding: "2rem", "max-width": "600px", margin: "0 auto" }}>
      <h1>ZDepth WASM Example</h1>

      {/* Tab Buttons */}
      <div
        style={{
          display: "flex",
          gap: "1rem",
          "margin-bottom": "1.5rem",
        }}
      >
        <button
          style={{
            width: "240px",
            padding: "0.5rem 0",
            border:
              activeTab() === "compress"
                ? "1px solid #b318f0"
                : "1px solid #ccc",
            background: activeTab() === "compress" ? "#f7f0fa" : "#fff",
            cursor: activeTab() === "compress" ? "default" : "pointer",
            "border-radius": "6px",
            "font-weight": "bold",
            color: activeTab() === "compress" ? "#b318f0" : "gray",
          }}
          disabled={activeTab() === "compress"}
          onClick={() => handleTabChange("compress")}
        >
          Compress
        </button>
        <button
          style={{
            width: "240px",
            padding: "0.5rem 0",
            border:
              activeTab() === "decompress"
                ? "1px solid #b318f0"
                : "1px solid #ccc",
            background: activeTab() === "decompress" ? "#f7f0fa" : "#fff",
            cursor: activeTab() === "decompress" ? "default" : "pointer",
            "border-radius": "6px",
            "font-weight": "bold",
            color: activeTab() === "decompress" ? "#b318f0" : "gray",
          }}
          disabled={activeTab() === "decompress"}
          onClick={() => handleTabChange("decompress")}
        >
          Decompress
        </button>
      </div>

      <Show when={zdepth.error()}>
        <div style={{ color: "red" }}>Error: {zdepth.error()}</div>
      </Show>

      {/* Compress Tab */}
      <Show when={activeTab() === "compress"}>
        <div>
          <div style={{ margin: "1rem 0" }}>
            <label>
              Upload Original Depth Data:{" "}
              <input
                type="file"
                accept=".bin,.raw,.tiff,.tif"
                onChange={(e) => handleFileUpload(e, false)}
              />
            </label>
            <label style={{ "margin-left": "1rem" }}>
              <input
                type="checkbox"
                checked={keyframe()}
                onChange={(e) => setKeyframe(e.currentTarget.checked)}
              />{" "}
              Keyframe
            </label>
          </div>

          <Show when={depthData()}>
            <div>
              <h3>
                Original Data ({depthData()?.width} x {depthData()?.height})
              </h3>
              <TiffPreview
                data={depthData()!.data}
                width={depthData()!.width}
                height={depthData()!.height}
              />
              <button onClick={handleCompress} disabled={zdepth.isLoading()}>
                {zdepth.isLoading() ? "Compressing..." : "Compress"}
              </button>
            </div>
          </Show>

          <Show when={compressedData()}>
            <div>
              <h3>
                Compressed ({compressedData()?.length.toLocaleString()} bytes)
              </h3>
              <button
                onClick={() =>
                  downloadBlob(
                    new Blob([compressedData()!]),
                    "compressed.zdepth"
                  )
                }
              >
                Download
              </button>
            </div>
          </Show>

          <Show when={decompressedData()}>
            <div>
              <h3>
                Decompressed ({decompressedData()?.width} x{" "}
                {decompressedData()?.height})
              </h3>
              <TiffPreview
                data={decompressedData()!.data}
                width={decompressedData()!.width}
                height={decompressedData()!.height}
              />
            </div>
          </Show>
        </div>
      </Show>

      {/* Decompress Tab */}
      <Show when={activeTab() === "decompress"}>
        <div>
          <div style={{ margin: "1rem 0" }}>
            <label>
              Upload Compressed Data:{" "}
              <input
                type="file"
                accept=".zdepth"
                onChange={(e) => handleFileUpload(e, true)}
              />
            </label>
          </div>

          <Show when={compressedData()}>
            <div>
              <h3>
                Compressed ({compressedData()?.length.toLocaleString()} bytes)
              </h3>
            </div>
          </Show>

          <Show when={decompressedData()}>
            <div>
              <h3>
                Decompressed ({decompressedData()?.width} x{" "}
                {decompressedData()?.height})
              </h3>
              <TiffPreview
                data={decompressedData()!.data}
                width={decompressedData()!.width}
                height={decompressedData()!.height}
              />
              <button onClick={() => downloadDecompressedAsTIFF()}>
                Download
              </button>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
};

export default ZDepthExample;
