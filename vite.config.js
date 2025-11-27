/*
 * @Author: morijiu
 * @Date: 2025-11-27 20:11:09
 * @LastEditors: Do not edit
 * @LastEditTime: 2025-11-27 20:41:58
 * @Description: 
 * @FilePath: \easy-dev-tools\vite.config.js
 */
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  
  // 构建优化
  build: {
    // 生成源码映射，便于调试（生产环境可设为 false）
    sourcemap: false,
    
    // 代码分割策略
    rollupOptions: {
      output: {
        // 手动分割代码块
        manualChunks: {
          'vue-vendor': ['vue', 'vue-router'],
        },
        // 静态资源文件名格式
        chunkFileNames: 'js/[name]-[hash].js',
        entryFileNames: 'js/[name]-[hash].js',
        assetFileNames: '[ext]/[name]-[hash].[ext]'
      }
    },
    
    // 压缩选项
    minify: 'terser',
    terserOptions: {
      compress: {
        // 生产环境移除 console
        drop_console: true,
        drop_debugger: true
      }
    },
    
    // chunk 大小警告限制（KB）
    chunkSizeWarningLimit: 1000,
    
    // 启用 CSS 代码分割
    cssCodeSplit: true,
    
    // 静态资源处理
    assetsInlineLimit: 4096, // 小于 4KB 的资源内联为 base64
  },
  
  // 服务器配置
  server: {
    port: 3000,
    open: true,
    cors: true
  },
  
  // 预览服务器配置
  preview: {
    port: 4173,
    open: true
  },
  
  // 路径别名
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@components': resolve(__dirname, 'src/components'),
      '@views': resolve(__dirname, 'src/views'),
      '@assets': resolve(__dirname, 'src/assets'),
      '@composables': resolve(__dirname, 'src/composables')
    }
  },
  
  // 优化依赖预构建
  optimizeDeps: {
    include: ['vue', 'vue-router']
  }
})
