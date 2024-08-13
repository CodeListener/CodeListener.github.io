import { analytics } from '@/config.json'

export function WebAnalytics() {
  if (import.meta.env.DEV || !analytics.enable) return null
  return (
    <>
      {analytics.umami.websiteId && <UmamiAnalytics {...analytics.umami} />}
      {analytics.google.measurementId && <GoogleAnalytics {...analytics.google} />}
      {analytics.microsoftClarity.projectId && <MicrosoftClarity {...analytics.microsoftClarity} />}
      {analytics.baidu.projectId && <BaiduAnalytics {...analytics.baidu} />}
    </>
  )
}

function UmamiAnalytics({ serverUrl, websiteId }: { serverUrl?: string; websiteId: string }) {
  const src = `${serverUrl || 'https://cloud.umami.is'}/script.js`

  return <script defer src={src} data-website-id={websiteId} />
}

function GoogleAnalytics({ measurementId }: { measurementId: string }) {
  return (
    <>
      <script async src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}></script>
      <script
        dangerouslySetInnerHTML={{
          __html: `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());

gtag('config', '${measurementId}');`,
        }}
      ></script>
    </>
  )
}

function MicrosoftClarity({ projectId }: { projectId: string }) {
  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(c,l,a,r,i,t,y){
            c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
            t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
            y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
          })(window, document, "clarity", "script", "${projectId}");`,
        }}
      ></script>
    </>
  )
}

function BaiduAnalytics({ projectId }: { projectId: string }) {
  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: `
        var _hmt = _hmt || [];
        (function() {
          var hm = document.createElement("script");
          hm.src = "https://hm.baidu.com/hm.js?${projectId}";
          var s = document.getElementsByTagName("script")[0]; 
          s.parentNode.insertBefore(hm, s);
        })();
      `,
        }}
      ></script>
    </>
  )
}
