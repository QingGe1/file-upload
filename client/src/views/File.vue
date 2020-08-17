<template>
  <div>
    <DragFile></DragFile>
  </div>
</template>

<script>
import { defineComponent } from "vue";
import DragFile from "@/components/File";

export default defineComponent({
  name: "File",
  components: { DragFile },
});
</script>

<style>
</style>