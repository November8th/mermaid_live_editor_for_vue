/**
 * 앱 진입점
 * Vue 2 애플리케이션을 초기화하고 MermaidLiveEditor를 마운트한다.
 */

(function () {
  'use strict';

  // Mermaid는 startOnLoad를 끄고, 항상 preview 컴포넌트가 수동 render를 호출한다.
  if (window.mermaid) {
    window.mermaid.initialize({
      startOnLoad: false,
      theme: 'base',
      securityLevel: 'loose',
      flowchart: {
        htmlLabels: true,
        curve: 'basis',
        padding: 15,
        nodeSpacing: 50,
        rankSpacing: 50,
        useMaxWidth: false
      },
      sequence: {
        useMaxWidth: false,
        diagramMarginY: 40,
        actorMargin: 80,
        messageMargin: 48
      },
      themeVariables: {
        darkMode: false,
        background: '#ffffff',
        primaryColor: '#e8edf8',
        primaryTextColor: '#1b2a4a',
        primaryBorderColor: '#b0bdd6',
        secondaryColor: '#f0f3fb',
        tertiaryColor: '#f4f6fb',
        lineColor: '#5c7ab0',
        textColor: '#1b2a4a',
        mainBkg: '#e8edf8',
        nodeBorder: '#b0bdd6',
        clusterBkg: '#f4f6fb',
        clusterBorder: '#c5cedf',
        titleColor: '#1b2a4a',
        edgeLabelBackground: '#ffffff',
        fontFamily: 'Inter, sans-serif',
        fontSize: '14px'
      }
    });
  }

  // Vue 인스턴스 생성
  new Vue({
    el: '#app',
    template: '<mermaid-live-editor></mermaid-live-editor>'
  });

})();
