import React from 'react';
import { Cpu, HardDrive, Zap, Activity } from 'lucide-react';

interface PerformanceMetricsProps {
  performance: {
    cpuUsage?: number;
    memoryUsage?: number;
    memoryUsed?: number;
    memoryTotal?: number;
    diskUsage?: number;
    gpuUsage?: number;
    vramUsage?: number;
    vramUsed?: number;
    vramTotal?: number;
  };
}

const MetricBar: React.FC<{ 
  value: number | undefined; 
  label: string; 
  icon: React.ReactNode; 
  color: string;
  subtitle?: string;
}> = ({ value, label, icon, color, subtitle }) => {
  const isUndefined = value === undefined || value === null || isNaN(value);
  const displayValue = isUndefined ? 0 : Math.min(Math.max(value, 0), 100);
  const displayText = isUndefined ? 'N/A' : `${displayValue.toFixed(1)}%`;

  return (
    <div className="space-y-2">
      <div className="flex items-center space-x-2">
        <div className={`${color} text-white p-1 rounded`}>
          {icon}
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">{label}</span>
            <span className="text-sm font-bold text-gray-900">{displayText}</span>
          </div>
          {subtitle && (
            <div className="text-xs text-gray-500 mt-0.5">{subtitle}</div>
          )}
        </div>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2.5">
        <div
          className={`h-2.5 rounded-full transition-all duration-500 ${
            isUndefined ? 'bg-gray-300' : `${color.replace('bg-', 'bg-')}`
          }`}
          style={{ width: `${displayValue}%` }}
        />
      </div>
    </div>
  );
};

const PerformanceMetrics: React.FC<PerformanceMetricsProps> = ({ performance }) => {
  // Format memory subtitle
  const getMemorySubtitle = () => {
    if (performance.memoryUsed !== undefined && performance.memoryTotal !== undefined) {
      return `${performance.memoryUsed.toFixed(1)}GB/${performance.memoryTotal.toFixed(1)}GB`;
    }
    return undefined;
  };

  // Format VRAM subtitle
  const getVramSubtitle = () => {
    if (performance.vramUsed !== undefined && performance.vramTotal !== undefined) {
      return `${performance.vramUsed.toFixed(1)}GB/${performance.vramTotal.toFixed(1)}GB`;
    }
    return undefined;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center space-x-2 mb-4">
        <Activity className="h-5 w-5 text-blue-600" />
        <h3 className="text-lg font-semibold text-gray-900">Performance Metrics</h3>
      </div>

      <div className="space-y-6">
        <MetricBar
          value={performance.cpuUsage}
          label="CPU"
          icon={<Cpu className="h-4 w-4" />}
          color="bg-blue-500"
        />

        <MetricBar
          value={performance.memoryUsage}
          label="MEMORY"
          icon={<Activity className="h-4 w-4" />}
          color="bg-green-500"
          subtitle={getMemorySubtitle()}
        />

        <MetricBar
          value={performance.diskUsage}
          label="DISK I/O"
          icon={<HardDrive className="h-4 w-4" />}
          color="bg-purple-500"
        />

        <MetricBar
          value={performance.gpuUsage}
          label="GPU"
          icon={<Zap className="h-4 w-4" />}
          color="bg-orange-500"
        />

        <MetricBar
          value={performance.vramUsage}
          label="VRAM"
          icon={<Zap className="h-4 w-4" />}
          color="bg-red-500"
          subtitle={getVramSubtitle()}
        />
      </div>
    </div>
  );
};

export default PerformanceMetrics;