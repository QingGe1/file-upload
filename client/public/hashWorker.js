self.importScripts('spark-md5.min.js');
self.onmessage = async (e) => {
  const { chunks } = e.data;
  const spark = new self.SparkMD5.ArrayBuffer();
  let count = 0;
  const loadNext = () => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        spark.append(e.target.result);
        resolve();
      }
      reader.readAsArrayBuffer(chunks[count].file)
    })
  }

  for (; count < chunks.length; count += 1) {
    await loadNext();
    if (count === chunks.length - 1) {
      self.postMessage({
        progress: 100,
        hash: spark.end()
      })
    } else {
      self.postMessage({ progress: count / chunks.length * 100 })
    }
  }

}