<template>
  <div>
    <div
      class="file-container"
      ref="container"
      @dragover="dragover"
      @dragleave="dragleave"
      @drop="drop"
    >{{state.msg}}</div>
    <div>文件名{{state.file?.name}}</div>
    <button @click="handleUpload">计算文件hash</button>
    <div>hashProgress:{{state.hashProgress}}</div>
    <input type="text" v-model="state.msg" />
  </div>
</template>

<script lang="ts">
import { defineComponent, reactive, ref, Ref, onMounted } from "vue";
import sparkMd5 from "spark-md5";
import request from "@/utils/request";

type fileChunks = { index: number; file: Blob };
type uploadFileChunk = {
  hash: string;
  chunk: Blob;
  name: string;
  index: number;
  progress: number;
};

const CHUNK_SIZE = 1 * 1024 * 1024;

const createFileChunk = (file: File, size: number = CHUNK_SIZE) => {
  const chunk: fileChunks[] = [];
  let cur = 0;
  while (cur < file.size) {
    chunk.push({ index: cur, file: file.slice(cur, cur + size) });
    cur += size;
  }
  return chunk;
};

const blobToString = (blob: Blob) => {
  return new Promise((resolve, reject) => {
    const reader: FileReader = new FileReader();
    reader.onload = () => {
      const ret = (reader.result as string)
        .split("")
        .map((v) => v.charCodeAt(0))
        .map((v) => v.toString(16).toUpperCase())
        .map((v) => v.padStart(2, "0")) // ES2017 引入了字符串补全长度的功能
        .join(" ");
      resolve(ret);
    };
    reader.onerror = (err) => {
      reject(err);
    };
    reader.readAsBinaryString(blob);
  });
};

const blonToData = async (blob: Blob) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result);
    };
    reader.onerror = (err) => reject(err);
    reader.readAsBinaryString(blob);
  });
};

const isJpg = async (file: File) => {
  const len = file.size;
  const start = await blobToString(file.slice(0, 2));
  const tail = await blobToString(file.slice(-2, len));
  const isjpg = start === "FF D8" && tail === "FF D9";
  return isjpg;
};
const isGif = async (file: File) => {
  const len = file.size;
  const ret = await blobToString(file.slice(0, 6));
  const isgif = ret === "47 49 46 38 39 61" || ret === "47 49 46 38 37 61";
  return isGif;
};
const isPng = async (file: File) => {
  const ret = await blobToString(file.slice(0, 8));
  const isPng = ret === "89 50 4E 47 0D 0A 1A 0A";
  return isPng;
};
const isImage = (file: File) => isJpg(file) || isGif(file) || isPng(file);

const ext = (filename: string) => {
  // 返回文件后缀名
  return filename.split(".").pop();
};
const calculateHash = async (file: File) => {
  const ret = await blonToData(file);
  return sparkMd5.hash(ret as string);
};

export default defineComponent({
  name: "File",
  setup(props, context) {
    const container: Ref<HTMLElement | null> = ref(null);
    const state: {
      msg: string;
      file: File | null;
      hashProgress: number;
      uploadFileChunks: uploadFileChunk[];
    } = reactive({
      msg: "请将文件拖拽到此区域",
      file: null,
      hashProgress: 0,
      uploadFileChunks: [],
    });
    onMounted(() => {});
    // 文件拖动
    const dragover = (event: DragEvent) => {
      (event.target as HTMLElement).style.borderColor = "red";
      event.preventDefault();
    };
    const dragleave = (event: DragEvent) => {
      (event.target as HTMLElement).style.borderColor = "#777";
      event.preventDefault();
    };
    const drop = (event: DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      (event.target as HTMLElement).style.borderColor = "#777";
      const file = event.dataTransfer?.files[0];
      state.file = file || null;
    };

    const calculateHashWorker = (chunks: fileChunks[]) => {
      return new Promise<string>((resolve, reject) => {
        const hashWorker = new Worker("/hashWorker.js");
        hashWorker.postMessage({ chunks });
        hashWorker.onmessage = (e) => {
          state.hashProgress = e.data.progress;
          if (e.data.hash) {
            resolve(e.data.hash as string);
          }
        };
      });
    };

    const calculateHashIdle = async (chunks: fileChunks[]) => {
      return new Promise<any>((resolve, reject) => {
        let count = 0;
        const spark = new sparkMd5.ArrayBuffer();
        const appendToSpark = (file: Blob) => {
          return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
              if (e.target) {
                spark.append(e.target.result as ArrayBuffer);
                resolve();
              }
            };
            reader.readAsArrayBuffer(file);
          });
        };
        const workLoop = async (deadline: any) => {
          while (count < chunks.length && deadline.timeRemaining() > 1) {
            await appendToSpark(chunks[count].file);
            count++;
            if (count < chunks.length) {
              // 计算中
              state.hashProgress = Number(
                ((100 * count) / chunks.length).toFixed(2)
              );
            } else {
              state.hashProgress = 100;
              resolve(spark.end());
            }
          }
          if (count < chunks.length) {
            (window as any).requestIdleCallback(workLoop);
          }
        };
        // 启动
        (window as any).requestIdleCallback(workLoop);
      });
    };

    const calculateHashSample = async (
      file: File,
      offset = 1 * 1024 * 1024
    ) => {
      return new Promise((resolve, reject) => {
        const size = file.size;
        // 文件开始的 offset 大小的文件全部添加到 chunks中
        const chunks = [file.slice(0, offset)];
        let cur = offset;
        while (cur < size) {
          if (cur + offset >= size) {
            // 文件末尾
            chunks.push(file.slice(cur, cur + offset));
          } else {
            // 文件中间
            const mid = cur + offset / 2;
            const end = cur + offset;
            chunks.push(
              new Blob([
                file.slice(cur, cur + 2),
                file.slice(mid, mid + 2),
                file.slice(end, end + 2),
              ])
            );
            // chunks.push(file.slice(cur, cur + 2));
            // chunks.push(file.slice(mid, mid + 2));
            // chunks.push(file.slice(end, end + 2));
          }
          cur += offset;
        }
        const reader = new FileReader();
        const spark = new sparkMd5.ArrayBuffer();
        reader.readAsArrayBuffer(new Blob(chunks));
        reader.onload = (e) => {
          if (e.target) {
            spark.append(e.target.result as ArrayBuffer);
            resolve(spark.end());
          }
        };
      });
    };

    // handleUpload
    const handleUpload = async () => {
      const file = state.file;
      if (!file) return;
      // 计算文件hash值
      // const hash = await calculateHash(file);
      // console.log(hash);
      // 分割文件 计算hash
      const chunks = createFileChunk(file);
      // web-worker
      // const hash = await calculateHashWorker(chunks);
      // window.requestIdleCallback
      const hash = await calculateHashIdle(chunks);
      // 文件抽样
      // const hash = await calculateHashSample(file);
      // console.log(hash);

      // 校验文件是否上传过
      // const { uploaded, uploadedList } = await request.get("/check", {
      //   hash: 1,
      //   ext: ext(file.name),
      // });
      const res = await request({
        url: "/upload/check",
        method: "POST",
        data: {
          ext: ext(file.name),
          hash,
        },
      });
      console.log(res);
      if (res.data.uploaded) {
        console.log("文件已存在 秒传");
        return;
      }
      const uploadedList = res.data.uploadedList;
      state.uploadFileChunks = chunks.map((chunk, index) => {
        const chunkName = hash + "-" + index;
        return {
          hash: hash,
          chunk: chunk.file,
          name: chunkName,
          index,
          progress: uploadedList.indexOf(chunkName) > -1 ? 100 : 0,
        };
      });
      await uploadChunks(state.uploadFileChunks, hash);
    };

    const uploadChunks = async (uploadFileChunks: uploadFileChunk[], hash: string) => {
      const file = state.file as File;
      const list = uploadFileChunks
        .filter((chunk) => chunk.progress === 0)
        .map(({ chunk, name, hash, index }, i) => {
          const form = new FormData();
          form.append("chunkname", name);
          form.append("ext", ext(file.name) as string);
          form.append("hash", hash);
          form.append("file", chunk);
          return { form, index, error: 0 };
        });
      try {
        await sendRequest([...list], 4); // 控制并发数
        await mergeRequest({
          ext: ext(file.name) as string,
          size: CHUNK_SIZE,
          hash: hash,
        });
      } catch (e) {
        console.log("上传似乎除了点小问题，重试试试哈");
      }
    };

    const sendRequest = (
      chunks: { form: FormData; index: number; error: number }[],
      limit = 4
    ) => {
      return new Promise((resolve, reject) => {
        let count = 0;
        let isStop = false;
        const len = chunks.length;
        const send = async () => {
          if (isStop) return;
          const task = chunks.shift();
          if (task) {
            const { form, index } = task;
            try {
              await request({
                method: "POST",
                url: "/upload/upload",
                data: form,
                onUploadProgress: (progress) => {
                  // TODO 进度 全局变量
                },
              });
              if (count == len - 1) {
                // 最后一个
                resolve();
              } else {
                count++;
                send();
              }
            } catch (error) {
              if (task.error < 3) {
                task.error++;
                // 队首进去 准备重试
                chunks.unshift(task);
                send();
              } else {
                // 错误3次了 直接结束
                isStop = true;
                reject();
              }
            }
          }
        };
        while (limit > 0) {
          send();
          limit -= 1;
        }
      });
    };
    const mergeRequest = async (data:any) => {
      await request({
        method: "POST",
        url: "/upload/merge",
        data,
      });
    };
    return {
      state,
      container,
      dragover,
      dragleave,
      drop,
      handleUpload,
    };
  },
});
</script>

<style>
.file-container {
  /* width: 500px; */
  height: 300px;
  margin: 0 auto;
  border: 1px dotted #777;
  border-radius: 10px;
}
</style>