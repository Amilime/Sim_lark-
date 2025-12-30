<template>
  <router-view />
</template>

<style>
/* 强制铺满屏幕，禁止浏览器默认的滚动条 */
html, body, #app {
  margin: 0;
  padding: 0;
  width: 100vw;
  height: 100vh;
  overflow: hidden; /* 关键：防止缩放时出现双重滚动条 */
  font-family: 'Helvetica Neue', Helvetica, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', Arial, sans-serif;
}
</style>