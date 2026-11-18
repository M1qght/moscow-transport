<script setup lang="ts">
import { NSlider } from 'naive-ui';
defineProps<{ modelValue: number }>();
defineEmits<{ 'update:modelValue': [value: number] }>();
</script>
<template>
  <div class="report-slider">
    <div class="report-slider__heading">
      <label id="load-label">Насколько заполнен салон?</label
      ><output class="report-slider__value">{{ modelValue }}<small>%</small></output>
    </div>
    <NSlider
      :value="modelValue"
      :min="0"
      :max="100"
      :step="5"
      aria-labelledby="load-label"
      @update:value="$emit('update:modelValue', $event)"
    />
    <div class="report-slider__labels"><span>Пусто</span><span>Свободных мест нет</span></div>
  </div>
</template>
