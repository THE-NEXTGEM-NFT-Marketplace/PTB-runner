// Cache busting script - run this to clear any cached modules
// Run this in the browser console

function clearModuleCache() {
  console.log('🧹 Clearing module cache...');
  
  // Clear any cached modules
  if (typeof window !== 'undefined') {
    // Clear any cached imports
    if (window.location.reload) {
      console.log('🔄 Reloading page to clear cache...');
      window.location.reload(true); // Force reload
    }
  }
}

// Alternative: Clear specific caches
function clearSpecificCache() {
  console.log('🧹 Clearing specific caches...');
  
  // Clear localStorage
  try {
    localStorage.clear();
    console.log('✅ localStorage cleared');
  } catch (e) {
    console.log('❌ Could not clear localStorage:', e);
  }
  
  // Clear sessionStorage
  try {
    sessionStorage.clear();
    console.log('✅ sessionStorage cleared');
  } catch (e) {
    console.log('❌ Could not clear sessionStorage:', e);
  }
  
  // Clear any service worker caches
  if ('caches' in window) {
    caches.keys().then(names => {
      names.forEach(name => {
        caches.delete(name);
        console.log(`✅ Cache cleared: ${name}`);
      });
    });
  }
  
  console.log('🎯 Cache clearing complete. Please refresh the page.');
}

// Export functions
window.clearModuleCache = clearModuleCache;
window.clearSpecificCache = clearSpecificCache;

console.log('Cache clearing functions loaded.');
console.log('Run clearModuleCache() to reload the page and clear cache.');
console.log('Run clearSpecificCache() to clear specific caches.');
