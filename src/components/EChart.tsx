import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

interface EChartProps {
  option: any;
  height?: number | string;
  className?: string;
}

export default function EChart({ option, height = 300, className = '' }: EChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  // 初始化 + resize 监听（只执行一次）
  useEffect(() => {
    if (!ref.current) return;
    chartRef.current = echarts.init(ref.current);

    const handleResize = () => chartRef.current?.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chartRef.current?.dispose();
      chartRef.current = null;
    };
  }, []);

  // option 变化时更新图表
  useEffect(() => {
    if (!chartRef.current) return;
    chartRef.current.setOption(option, true);
  }, [option]);

  return (
    <div
      ref={ref}
      className={`echarts-container ${className}`}
      style={{ height: typeof height === 'number' ? `${height}px` : height }}
    />
  );
}
