// 文件下载统一入口（R10b4）：收敛各工具手抄的 Blob + createObjectURL + <a download>
// 骨架。行为与迁移前保持一致：创建临时锚点、触发点击、随即 revokeObjectURL；
// data: URL 下载（二维码图）不走 ObjectURL、不 revoke。
export function useDownload() {
  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadText = (text, filename, type = 'text/plain;charset=utf-8') => {
    downloadBlob(new Blob([text], { type }), filename);
  };

  const downloadUrl = (url, filename) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
  };

  return { downloadBlob, downloadText, downloadUrl };
}
