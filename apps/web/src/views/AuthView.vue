<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { NInput, NButton, NAlert, useMessage } from 'naive-ui';
import { BusFront, ArrowRight } from '@lucide/vue';
import { useAuthStore } from '../stores/auth';
const auth = useAuthStore();
const router = useRouter();
const message = useMessage();
const register = ref(false);
const login = ref('');
const password = ref('');
const name = ref('');
const busy = ref(false);
async function submit() {
  busy.value = true;
  try {
    await auth.signIn(login.value, password.value, register.value ? name.value : undefined);
    await router.push(auth.user?.role === 'ADMIN' ? '/admin' : '/');
  } catch (e) {
    message.error((e as Error).message);
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <section class="auth-page">
    <div class="auth-page__story">
      <BusFront :size="40" />
      <p class="eyebrow">ВМЕСТЕ В ОДНОМ ГОРОДЕ</p>
      <h1>Хорошая поездка<br />начинается<br />с маленькой отметки.</h1>
      <p>
        Расскажите, насколько заполнен салон.<br />Кто-то на следующей остановке скажет спасибо.
      </p>
    </div>
    <form class="auth-form" @submit.prevent="submit">
      <p class="eyebrow">ДОБРО ПОЖАЛОВАТЬ</p>
      <h2>{{ register ? 'Создать аккаунт' : 'С возвращением' }}</h2>
      <label v-if="register"
        >Ваше имя<NInput
          v-model:value="name"
          required
          :maxlength="60"
          placeholder="Иван"
          autocomplete="name" /></label
      ><label
        >Логин<NInput
          v-model:value="login"
          required
          :maxlength="32"
          placeholder="ivan"
          autocomplete="username" /></label
      ><small>3–32 символа: латиница, цифры и _</small
      ><label
        >Пароль<NInput
          v-model:value="password"
          required
          type="password"
          show-password-on="click"
          :maxlength="128"
          :input-props="{
            minlength: 8,
            autocomplete: register ? 'new-password' : 'current-password',
          }"
          placeholder="Не меньше 8 символов" /></label
      ><NButton type="primary" attr-type="submit" block :loading="busy"
        >{{ register ? 'Зарегистрироваться' : 'Войти' }} <ArrowRight :size="16" /></NButton
      ><button class="auth-form__switch" type="button" @click="register = !register">
        {{ register ? 'Уже есть аккаунт? Войти' : 'Впервые здесь? Зарегистрироваться' }}</button
      ><NAlert type="info" :show-icon="false"
        >Аккаунт нужен для отметок. Смотреть карту можно без регистрации.</NAlert
      >
    </form>
  </section>
</template>
