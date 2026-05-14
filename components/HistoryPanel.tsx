import React, { useEffect, useState } from 'react';
import { historyDb, GenerationSession } from '../db';
import { X, Clock, Trash2, ExternalLink, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

interface HistoryPanelProps {
  onClose: () => void;
  onRestore: (session: GenerationSession) => void;
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({ onClose, onRestore }) => {
  const [sessions, setSessions] = useState<GenerationSession[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSessions = async () => {
    setLoading(true);
    try {
      const allSessions = await historyDb.sessions.orderBy('timestamp').reverse().toArray();
      setSessions(allSessions);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const deleteSession = async (id: number) => {
    if (!confirm('确定要删除这条记录吗？')) return;
    await historyDb.sessions.delete(id);
    loadSessions();
  };

  const getTypeName = (type: string) => {
    switch (type) {
      case 'selfie_var': return '自拍变身';
      case 'try_on': return '模特换装';
      case 'batch_tryon': return '批量换装自拍';
      case 'poses': return '姿势生成';
      case 'same_pose': return '同姿势变体';
      case 'magic': return '局部重绘';
      case 'pose_transfer': return '姿势迁移';
      default: return type;
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center pt-20 px-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose}></div>
      <div className="bg-white border border-slate-200 shadow-2xl rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col pointer-events-auto animate-in fade-in slide-in-from-top-4 duration-200">
        <div className="flex justify-between items-center p-6 border-b border-slate-100">
          <div>
            <h3 className="text-xl font-bold text-slate-800">历史生成记录</h3>
            <p className="text-sm text-slate-500 mt-1">记录保存在您的浏览器本地 (IndexedDB)</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <RefreshCw className="animate-spin mb-4" size={32} />
              <p>加载中...</p>
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-20 text-slate-400">
              <Clock size={48} className="mx-auto mb-4 opacity-20" />
              <p>暂无历史记录</p>
            </div>
          ) : (
            <div className="space-y-4">
              {sessions.map((session) => (
                <div 
                  key={session.id} 
                  className="group relative bg-slate-50 border border-slate-200 rounded-xl p-4 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer"
                  onClick={() => onRestore(session)}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex gap-4">
                      <div className="w-16 h-20 bg-slate-200 rounded-lg overflow-hidden flex-shrink-0">
                         {/* Preview first result image if available */}
                         {session.data.results?.[0]?.result?.imageUrl ? (
                           <img src={session.data.results[0].result.imageUrl} className="w-full h-full object-cover" alt="" />
                         ) : session.data.sourceImage?.base64 ? (
                           <img src={`data:${session.data.sourceImage.mimeType};base64,${session.data.sourceImage.base64}`} className="w-full h-full object-cover" alt="" />
                         ) : session.data.selfieSourceImages?.[0]?.base64 ? (
                            <img src={`data:${session.data.selfieSourceImages[0].mimeType};base64,${session.data.selfieSourceImages[0].base64}`} className="w-full h-full object-cover" alt="" />
                         ) : (
                           <div className="w-full h-full flex items-center justify-center text-slate-400">
                             <Box size={20} />
                           </div>
                         )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded uppercase">
                            {getTypeName(session.type)}
                          </span>
                          <span className="text-xs text-slate-400">
                            {format(new Date(session.timestamp), 'yyyy-MM-dd HH:mm:ss')}
                          </span>
                        </div>
                        <h4 className="font-bold text-slate-700 truncate max-w-[300px]">
                          {session.name || '未命名任务'}
                        </h4>
                        <p className="text-xs text-slate-500 mt-1">
                          {Array.isArray(session.data.results) ? `共 ${session.data.results.length} 张图片` : ''}
                          {session.type === 'try_on' ? ` (包含 ${session.data.tryOnClothingImages?.length || 0} 件衣服)` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                       <button 
                         onClick={(e) => {
                           e.stopPropagation();
                           onRestore(session);
                         }}
                         className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                         title="还原"
                       >
                         <ExternalLink size={18} />
                       </button>
                       <button 
                         onClick={(e) => {
                           e.stopPropagation();
                           deleteSession(session.id!);
                         }}
                         className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                         title="删除"
                       >
                         <Trash2 size={18} />
                       </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
