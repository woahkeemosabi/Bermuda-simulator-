// iPhone FFT-core QA opt-in only. Default Crisp and production behaviour stay unchanged.
export function vendorStreamEnabled(search='',userAgent='') {
 const q=new URLSearchParams(search);
 return /iPhone|iPad|iPod/.test(userAgent) && q.get('gpuTrace')==='1' &&
  q.get('traceCase')==='fftcore' && q.get('vendorStream')==='1';
}
export function vendorReleaseReady(distanceSquared,secondsAway) {
 return distanceSquared > 24*24 && secondsAway >= 3;
}
