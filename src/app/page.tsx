'use client';

import { useState, useRef, MouseEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Activity,
  BoxSelect,
  CheckCircle2,
  ImagePlus,
  Loader2,
  MousePointer2,
  RefreshCw,
  ScanLine,
  Trash2,
  Upload,
} from 'lucide-react';

interface Box {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'WG' | 'CG'; // Box type: WG (Whole Gland) or CG (Central Gland)
}

interface SegmentationResult {
  success: boolean;
  masks?: {
    WG?: string;  // Whole Gland mask
    CG?: string;  // Central Gland mask
    PZ?: string;  // Peripheral Zone mask (WG - CG)
  };
  error?: string;
}

const SAMPLE_IMAGE_PATHS = [
  '/assets/test_image.png',
  '/assets/samples/sample1.png',
  '/assets/image.png',
];

export default function MedicalSAMDemo() {
  const [image, setImage] = useState<string | null>(null);
  const [boxes, setBoxes] = useState<Box[]>([]); // Multiple boxes support
  const [selectedBoxType, setSelectedBoxType] = useState<'WG' | 'CG'>('WG'); // Default to WG
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [currentBox, setCurrentBox] = useState<Box | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<SegmentationResult | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const [useMedicalMode, setUseMedicalMode] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Use ref to track drawing state synchronously
  const isDrawingRef = useRef(false);
  const currentBoxRef = useRef<Box | null>(null);

  // Generate unique ID for boxes
  const generateBoxId = () => `box-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Load sample image for quick testing
  const loadSampleImage = (pathIndex = 0) => {
    const samplePath = SAMPLE_IMAGE_PATHS[pathIndex];

    if (!samplePath) {
      console.error('Failed to load sample image from all known paths');
      alert('示例图像加载失败，请确认 public/assets/test_image.png 已存在');
      return;
    }

    const sampleImage = new Image();
    sampleImage.onload = () => {
      setImageDimensions({ width: sampleImage.width, height: sampleImage.height });
      setImage(samplePath);
      setBoxes([]); // Clear all boxes
      setResult(null);
      setStartPoint(null);
      setCurrentBox(null);
    };
    sampleImage.onerror = () => {
      console.warn(`Failed to load sample image: ${samplePath}`);
      loadSampleImage(pathIndex + 1);
    };
    sampleImage.src = samplePath;
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          setImageDimensions({ width: img.width, height: img.height });
          setImage(event.target?.result as string);
          setBoxes([]); // Clear all boxes
          setResult(null);
          setStartPoint(null);
          setCurrentBox(null);
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    if (!image || !imageDimensions) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const scaleX = imageDimensions.width / rect.width;
    const scaleY = imageDimensions.height / rect.height;

    const x = Math.round((e.clientX - rect.left) * scaleX);
    const y = Math.round((e.clientY - rect.top) * scaleY);

    const newBox = { id: generateBoxId(), x, y, width: 0, height: 0, type: selectedBoxType };
    console.log('[MouseDown] Start drawing at:', { x, y, type: selectedBoxType });

    // Update both state and ref
    setStartPoint({ x, y });
    setIsDrawing(true);
    setCurrentBox(newBox);

    // Update refs for synchronous access
    isDrawingRef.current = true;
    currentBoxRef.current = newBox;
  };

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!isDrawingRef.current || !startPoint || !imageDimensions) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const scaleX = imageDimensions.width / rect.width;
    const scaleY = imageDimensions.height / rect.height;

    const currentX = Math.round((e.clientX - rect.left) * scaleX);
    const currentY = Math.round((e.clientY - rect.top) * scaleY);

    const width = currentX - startPoint.x;
    const height = currentY - startPoint.y;

    // Update current box properties while preserving id and type
    const updatedBox = {
      x: width < 0 ? currentX : startPoint.x,
      y: height < 0 ? currentY : startPoint.y,
      width: Math.abs(width),
      height: Math.abs(height),
    };

    // Update state and ref with the new box dimensions
    setCurrentBox((prevBox) => {
      if (prevBox) {
        const newBox = { ...prevBox, ...updatedBox };
        // Also update the ref synchronously
        currentBoxRef.current = newBox;
        return newBox;
      }
      return null;
    });
  };

  const handleMouseUp = () => {
    console.log('[MouseUp] isDrawingRef:', isDrawingRef.current, 'currentBoxRef:', currentBoxRef.current);

    // Use ref to get the latest values
    if (isDrawingRef.current && currentBoxRef.current && currentBoxRef.current.width > 0 && currentBoxRef.current.height > 0) {
      console.log('[MouseUp] Adding box:', currentBoxRef.current);
      const boxToAdd = { ...currentBoxRef.current }; // Create a copy to avoid reference issues
      setBoxes(prev => [...prev, boxToAdd]);
    }

    // Reset both state and ref
    setIsDrawing(false);
    isDrawingRef.current = false;
    setStartPoint(null);
    setCurrentBox(null);
    currentBoxRef.current = null;
  };

  const handleMouseLeave = () => {
    console.log('[MouseLeave] isDrawingRef:', isDrawingRef.current, 'currentBoxRef:', currentBoxRef.current);

    // Only clear if we're drawing but haven't created a valid box yet
    if (isDrawingRef.current && (!currentBoxRef.current || currentBoxRef.current.width === 0 || currentBoxRef.current.height === 0)) {
      console.log('[MouseLeave] Clearing current box');
    }

    // Reset both state and ref
    setIsDrawing(false);
    isDrawingRef.current = false;
    setStartPoint(null);
    setCurrentBox(null);
    currentBoxRef.current = null;
  };

  // Function to delete a specific box
  const deleteBox = (boxId: string) => {
    setBoxes(prev => prev.filter(box => box.id !== boxId));
    setResult(null); // Clear results when boxes change
  };

  // Function to clear all boxes
  const clearAllBoxes = () => {
    setBoxes([]);
    setResult(null);
  };

  const handleSegment = async () => {
    if (!image || boxes.length === 0) {
      console.warn('No image or boxes provided');
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/segment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image,
          boxes,  // Send all boxes
          useMedical: useMedicalMode,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Segmentation failed');
      }

      setResult(data);
    } catch (error) {
      console.error('Error:', error);
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetAll = () => {
    setImage(null);
    setBoxes([]);
    setResult(null);
    setImageDimensions(null);
    setStartPoint(null);
    setCurrentBox(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Combine boxes with current drawing box for display
  const displayBoxes = [...boxes, ...(currentBox && isDrawing ? [currentBox] : [])];
  const wgCount = boxes.filter((box) => box.type === 'WG').length;
  const cgCount = boxes.filter((box) => box.type === 'CG').length;
  const readyForPz = wgCount > 0 && cgCount > 0;
  const statusText = boxes.length > 0
    ? `${boxes.length} 个标注框: ${boxes.map((box) => box.type).join(', ')}`
    : isDrawing
      ? '正在绘制标注框...'
      : '点击并拖拽图像以绘制 WG 或 CG 标注框';

  return (
    <main className="min-h-screen bg-[#f6f8fb] text-slate-950 dark:bg-slate-950 dark:text-slate-50">
      <div className="mx-auto flex min-h-screen w-full max-w-[1540px] flex-col px-4 py-4 sm:px-6 lg:px-8">
        <header className="mb-4 flex flex-col gap-4 border-b border-slate-200/80 pb-4 dark:border-slate-800 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-950">
              <ScanLine className="size-6" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-700 dark:text-sky-300">
                AI-assisted prostate MRI segmentation
              </p>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white md:text-3xl">
                ProZoneSAM2
              </h1>
            </div>
          </div>
          <img
            src="/深圳河套学院.png"
            alt="深圳河套学院"
            className="h-16 w-auto max-w-[360px] object-contain opacity-95 md:h-20 lg:h-24"
          />
        </header>

        <section className="grid flex-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)_300px]">
          <aside className="space-y-4">
            <Card className="gap-4 border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200">
                  <CheckCircle2 className="size-3.5" />
                  Model Ready
                </div>
                <h2 className="text-xl font-semibold leading-tight text-slate-950 dark:text-white">
                  面向前列腺分区的交互式分割工作台
                </h2>
                <p className="text-sm leading-6 text-slate-600 dark:text-slate-400">
                  ProZoneSAM2 基于 SAM2 构建，并使用边界框提示进行交互式前列腺区域分割。用户上传医学图像后，通过框选全腺体 WG 和中央腺体 CG，引导模型生成中央腺体与外周带 PZ 的分割结果。
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/60">
                  <div className="text-lg font-semibold text-sky-700 dark:text-sky-300">{wgCount}</div>
                  <div className="text-[11px] uppercase text-slate-500">WG boxes</div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/60">
                  <div className="text-lg font-semibold text-orange-600 dark:text-orange-300">{cgCount}</div>
                  <div className="text-[11px] uppercase text-slate-500">CG boxes</div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/60">
                  <div className={`text-lg font-semibold ${readyForPz ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-400'}`}>
                    {readyForPz ? 'Ready' : 'Wait'}
                  </div>
                  <div className="text-[11px] uppercase text-slate-500">PZ</div>
                </div>
              </div>
            </Card>

            <Card className="gap-4 border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-950 dark:text-white">图像输入</h2>
                <ImagePlus className="size-4 text-slate-400" />
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                id="image-upload"
              />
              <div className="grid gap-2">
                <label htmlFor="image-upload">
                  <Button className="h-10 w-full bg-slate-950 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200" asChild>
                    <span>
                      <Upload className="size-4" />
                      上传医学图像
                    </span>
                  </Button>
                </label>
                <Button variant="outline" onClick={() => loadSampleImage()} className="h-10 w-full">
                  <ImagePlus className="size-4" />
                  载入示例图像
                </Button>
                {image && (
                  <Button variant="ghost" onClick={resetAll} className="h-10 w-full text-slate-600 dark:text-slate-300">
                    <RefreshCw className="size-4" />
                    重置工作台
                  </Button>
                )}
              </div>
            </Card>

            <Card className="gap-4 border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-950 dark:text-white">标注设置</h2>
                <BoxSelect className="size-4 text-slate-400" />
              </div>
              <div className="grid gap-2">
                <label
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition ${
                    selectedBoxType === 'WG'
                      ? 'border-sky-400 bg-sky-50 text-sky-950 dark:border-sky-500 dark:bg-sky-950/40 dark:text-sky-100'
                      : 'border-slate-200 bg-white hover:border-sky-200 dark:border-slate-800 dark:bg-slate-900'
                  }`}
                >
                  <input
                    type="radio"
                    id="wg-type"
                    name="boxType"
                    checked={selectedBoxType === 'WG'}
                    onChange={() => setSelectedBoxType('WG')}
                    className="size-4 text-sky-600"
                  />
                  <span className="flex flex-1 items-center justify-between gap-3">
                    <span className="font-semibold">WG</span>
                    <span className="text-sm text-slate-600 dark:text-slate-400">全腺体</span>
                  </span>
                </label>
                <label
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition ${
                    selectedBoxType === 'CG'
                      ? 'border-orange-400 bg-orange-50 text-orange-950 dark:border-orange-500 dark:bg-orange-950/40 dark:text-orange-100'
                      : 'border-slate-200 bg-white hover:border-orange-200 dark:border-slate-800 dark:bg-slate-900'
                  }`}
                >
                  <input
                    type="radio"
                    id="cg-type"
                    name="boxType"
                    checked={selectedBoxType === 'CG'}
                    onChange={() => setSelectedBoxType('CG')}
                    className="size-4 text-orange-600"
                  />
                  <span className="flex flex-1 items-center justify-between gap-3">
                    <span className="font-semibold">CG</span>
                    <span className="text-sm text-slate-600 dark:text-slate-400">中央腺体</span>
                  </span>
                </label>
              </div>
              <p className="rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600 dark:bg-slate-950/60 dark:text-slate-400">
                先绘制 WG，再切换到 CG 绘制第二个框。两类标注同时存在时，模型可推导 PZ 外周带区域。
              </p>
            </Card>

            <Card className="gap-4 border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-base font-semibold text-slate-950 dark:text-white">模型模式</h2>
              <div className="grid grid-cols-2 gap-2">
                <label
                  className={`cursor-pointer rounded-lg border p-3 text-sm transition ${
                    !useMedicalMode
                      ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-950'
                      : 'border-slate-200 bg-white text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'
                  }`}
                >
                  <input
                    type="radio"
                    id="basic-mode"
                    name="mode"
                    checked={!useMedicalMode}
                    onChange={() => setUseMedicalMode(false)}
                    className="sr-only"
                  />
                  基础 SAM2
                </label>
                <label
                  className={`cursor-pointer rounded-lg border p-3 text-sm transition ${
                    useMedicalMode
                      ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-950'
                      : 'border-slate-200 bg-white text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'
                  }`}
                >
                  <input
                    type="radio"
                    id="medical-mode"
                    name="mode"
                    checked={useMedicalMode}
                    onChange={() => setUseMedicalMode(true)}
                    className="sr-only"
                  />
                  ProZoneSAM2
                </label>
              </div>
            </Card>
          </aside>

          <section className="min-w-0">
            <Card className="h-full gap-4 border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 dark:border-slate-800 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-950 dark:text-white">分割画布</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{statusText}</p>
                </div>
                <Button
                  onClick={handleSegment}
                  disabled={boxes.length === 0 || isLoading}
                  className="h-10 min-w-[150px] bg-sky-700 text-white hover:bg-sky-800"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      处理中...
                    </>
                  ) : (
                    <>
                      <Activity className="size-4" />
                      运行分割
                    </>
                  )}
                </Button>
              </div>

              {!image ? (
                <div className="flex min-h-[520px] flex-1 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950/60 xl:aspect-[16/9]">
                  <div className="mx-auto max-w-md px-6 text-center">
                    <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-lg bg-white text-sky-700 shadow-sm dark:bg-slate-900 dark:text-sky-300">
                      <MousePointer2 className="size-7" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-950 dark:text-white">上传图像后开始交互标注</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
                      使用鼠标在图像区域拖拽绘制提示框。
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-lg border border-slate-200 bg-slate-950 p-3 shadow-inner dark:border-slate-800">
                    <div
                      ref={canvasRef}
                      onMouseDown={handleMouseDown}
                      onMouseMove={handleMouseMove}
                      onMouseUp={handleMouseUp}
                      onMouseLeave={handleMouseLeave}
                      className="relative mx-auto overflow-hidden rounded-md border border-white/10 bg-black cursor-crosshair"
                      style={{
                        width: '100%',
                        paddingBottom: imageDimensions
                          ? `${(imageDimensions.height / imageDimensions.width) * 100}%`
                          : '75%',
                      }}
                    >
                      <img
                        src={image}
                        alt="上传的图像"
                        className="absolute inset-0 h-full w-full select-none object-contain"
                        draggable={false}
                      />

                      {result?.masks && (
                        <div className="pointer-events-none absolute inset-0">
                          {result.masks.CG && (
                            <img
                              src={result.masks.CG}
                              alt="CG Mask"
                              className="absolute inset-0 h-full w-full object-contain"
                              style={{ opacity: 0.7 }}
                            />
                          )}
                          {result.masks.PZ && (
                            <img
                              src={result.masks.PZ}
                              alt="PZ Mask"
                              className="absolute inset-0 h-full w-full object-contain"
                              style={{ opacity: 0.7 }}
                            />
                          )}
                        </div>
                      )}

                      {(!result?.masks || isDrawing) && displayBoxes.length > 0 && imageDimensions && (
                        <>
                          {displayBoxes.map((displayBox) => (
                            <div
                              key={displayBox.id}
                              className={`pointer-events-none absolute border-2 ${
                                displayBox.type === 'WG'
                                  ? 'border-sky-400 bg-sky-400/20'
                                  : 'border-orange-400 bg-orange-400/20'
                              }`}
                              style={{
                                left: `${(displayBox.x / imageDimensions.width) * 100}%`,
                                top: `${(displayBox.y / imageDimensions.height) * 100}%`,
                                width: `${(displayBox.width / imageDimensions.width) * 100}%`,
                                height: `${(displayBox.height / imageDimensions.height) * 100}%`,
                              }}
                            >
                              <div
                                className={`absolute left-0 top-0 -translate-y-full rounded-t px-2 py-0.5 text-xs font-bold text-white ${
                                  displayBox.type === 'WG' ? 'bg-sky-500' : 'bg-orange-500'
                                }`}
                              >
                                {displayBox.type}
                              </div>
                              <div className={`absolute -left-1 -top-1 size-3 border-l-2 border-t-2 ${displayBox.type === 'WG' ? 'border-sky-300' : 'border-orange-300'}`} />
                              <div className={`absolute -right-1 -top-1 size-3 border-r-2 border-t-2 ${displayBox.type === 'WG' ? 'border-sky-300' : 'border-orange-300'}`} />
                              <div className={`absolute -bottom-1 -left-1 size-3 border-b-2 border-l-2 ${displayBox.type === 'WG' ? 'border-sky-300' : 'border-orange-300'}`} />
                              <div className={`absolute -bottom-1 -right-1 size-3 border-b-2 border-r-2 ${displayBox.type === 'WG' ? 'border-sky-300' : 'border-orange-300'}`} />
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  </div>

                  {result?.error && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200">
                      <strong>错误：</strong> {result.error}
                    </div>
                  )}
                </div>
              )}
            </Card>
          </section>

          <aside className="space-y-4 lg:col-span-2 xl:col-span-1">
            <Card className="gap-4 border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-950 dark:text-white">结果状态</h2>
                {result?.success ? (
                  <CheckCircle2 className="size-4 text-emerald-600" />
                ) : (
                  <Activity className="size-4 text-slate-400" />
                )}
              </div>
              {result?.success && result.masks ? (
                <div className="space-y-3">
                  <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200">
                    分割完成，结果已叠加显示在中央画布。
                  </p>
                  <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                    {result.masks.CG && (
                      <div className="flex items-center gap-2">
                        <span className="size-2.5 rounded-full bg-emerald-500" />
                        <span>CG 中央腺体</span>
                      </div>
                    )}
                    {result.masks.PZ && (
                      <div className="flex items-center gap-2">
                        <span className="size-2.5 rounded-full bg-sky-500" />
                        <span>PZ 外周带</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm leading-6 text-slate-600 dark:text-slate-400">
                  运行分割后，这里会显示成功状态和颜色图例。当前结果默认叠加 CG 与 PZ，便于快速判断分区边界。
                </p>
              )}
            </Card>

            <Card className="gap-4 border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-950 dark:text-white">标注框</h2>
                {boxes.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearAllBoxes}
                    className="h-8 text-red-600 hover:text-red-700"
                  >
                    清除全部
                  </Button>
                )}
              </div>

              {boxes.length > 0 ? (
                <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
                  {boxes.filter((box) => box != null).map((box, index) => (
                    <div
                      key={box.id}
                      className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm"
                      style={{
                        borderColor: box.type === 'WG' ? 'rgba(14, 165, 233, 0.35)' : 'rgba(249, 115, 22, 0.35)',
                        backgroundColor: box.type === 'WG' ? 'rgba(14, 165, 233, 0.06)' : 'rgba(249, 115, 22, 0.06)',
                      }}
                    >
                      <div className="min-w-0">
                        <div className={`font-semibold ${box.type === 'WG' ? 'text-sky-700 dark:text-sky-300' : 'text-orange-600 dark:text-orange-300'}`}>
                          {index + 1}. {box.type}
                        </div>
                        <div className="truncate text-xs text-slate-500 dark:text-slate-400">
                          {box.width} x {box.height} at ({box.x}, {box.y})
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => deleteBox(box.id)}
                        className="text-red-600 hover:text-red-700"
                        aria-label={`删除 ${box.type} 标注框`}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-slate-300 p-4 text-sm leading-6 text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  暂无标注框。选择 WG 或 CG 后，在图像上拖拽即可添加。
                </div>
              )}
            </Card>

            <Card className="gap-3 border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-base font-semibold text-slate-950 dark:text-white">操作流程</h2>
              <ol className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
                <li className="flex gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-slate-900 text-xs font-semibold text-white dark:bg-white dark:text-slate-950">1</span>
                  上传图像或载入示例图像。
                </li>
                <li className="flex gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-slate-900 text-xs font-semibold text-white dark:bg-white dark:text-slate-950">2</span>
                  选择 WG/CG，在画布上拖拽生成提示框。
                </li>
                <li className="flex gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-slate-900 text-xs font-semibold text-white dark:bg-white dark:text-slate-950">3</span>
                  点击运行分割，查看 CG 与 PZ 分割结果。
                </li>
              </ol>
            </Card>
          </aside>
        </section>
      </div>
    </main>
  );
}
