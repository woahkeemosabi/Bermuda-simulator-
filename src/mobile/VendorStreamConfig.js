// iPhone QA opt-in: retain full-resolution vendor textures when nearby,
// release only far-away textures. Production behaviour stays unchanged.
export function vendorStreamEnabled(search='',userAgent='') {
 const q=new URLSearchParams(search);
 return /iPhone|iPad|iPod/.test(userAgent) && q.get('gpuTrace')==='1' &&
  (q.get('traceCase')==='fftcore' || (q.get('traceCase')==='full' && q.get('qualityTest')==='crisp')) && q.get('vendorStream')==='1';
}
export function vendorReleaseReady(distanceSquared,secondsAway) {
 return distanceSquared > 24*24 && secondsAway >= 3;
}
