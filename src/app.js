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
      theme: 'default',
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
      }
    });
  }

  // Vue 인스턴스 생성
  new Vue({
    el: '#app',
    template: '<mermaid-live-editor></mermaid-live-editor>'
  });

})();
