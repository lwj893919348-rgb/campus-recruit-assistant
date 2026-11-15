import net from 'node:net';

const MULTI_PART_TLDS = new Set([
  'com.cn',
  'net.cn',
  'org.cn',
  'edu.cn',
  'gov.cn',
  'ac.cn',
  'co.uk',
  'co.jp',
  'com.hk',
  'com.tw',
]);

export function extractRootDomain(hostname = '') {
  const clean = hostname.toLowerCase().replace(/\.+$/, '');
  if (!clean) return '';
  const parts = clean.split('.').filter(Boolean);
  if (parts.length <= 2) return clean;
  const lastTwo = `${parts[parts.length - 2]}.${parts[parts.length - 1]}`;
  if (MULTI_PART_TLDS.has(lastTwo) && parts.length >= 3) {
    return `${parts[parts.length - 3]}.${lastTwo}`;
  }
  return lastTwo;
}

export function isDomainMatch(resolvedHostname, expectedDomain) {
  if (!resolvedHostname || !expectedDomain) return false;
  const host = resolvedHostname.toLowerCase();
  const expected = expectedDomain.toLowerCase().replace(/^\.+/, '');
  return host === expected || host.endsWith(`.${expected}`);
}

export function isPrivateOrLoopbackHost(hostname = '') {
  const h = hostname.toLowerCase();
  if (h === 'localhost' || h === '::1' || h.endsWith('.local')) return true;
  if (net.isIPv4(h)) {
    const [a, b] = h.split('.').map(Number);
    if (a === 127 || a === 10 || a === 0) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
  }
  if (net.isIPv6(h) && (h === '::1' || h.startsWith('fe80:') || h.startsWith('fc') || h.startsWith('fd'))) {
    return true;
  }
  return false;
}

function extractHtmlTitle(html = '') {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match) return '';
  return match[1].replace(/\s+/g, ' ').trim().slice(0, 120);
}

/**
 * Performs a compliant, standard HTTP check on a campus recruitment portal URL.
 * Never attempts to bypass CAPTCHA, WAF, or authentication walls.
 */
export async function verifyOfficialUrl(
  targetUrl,
  expectedDomain = '',
  { fetchImpl = globalThis.fetch, timeoutMs = 6000, allowPrivateHosts = false } = {},
) {
  const checkedAt = new Date().toISOString();
  let parsed;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return {
      ok: false,
      targetUrl,
      finalUrl: '',
      httpStatus: null,
      resolvedDomain: '',
      expectedDomain: expectedDomain || '',
      isDomainMatch: false,
      resultStatus: 'invalid_url',
      pageTitle: '',
      message: '链接格式无效，仅支持完整的 http/https 网址。',
      checkedAt,
    };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      ok: false,
      targetUrl,
      finalUrl: '',
      httpStatus: null,
      resolvedDomain: parsed.hostname,
      expectedDomain: expectedDomain || extractRootDomain(parsed.hostname),
      isDomainMatch: false,
      resultStatus: 'invalid_url',
      pageTitle: '',
      message: '安全校验拦截：仅支持 http 或 https 协议的官方网站链接。',
      checkedAt,
    };
  }

  if (!allowPrivateHosts && isPrivateOrLoopbackHost(parsed.hostname)) {
    return {
      ok: false,
      targetUrl,
      finalUrl: '',
      httpStatus: null,
      resolvedDomain: parsed.hostname,
      expectedDomain: expectedDomain || '',
      isDomainMatch: false,
      resultStatus: 'blocked_private_host',
      pageTitle: '',
      message: '禁止核验内网或本机保留地址。',
      checkedAt,
    };
  }

  const targetExpected = expectedDomain || extractRootDomain(parsed.hostname);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(targetUrl, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CampusNav-Verifier/1.0)',
        Accept: 'text/html,application/json;q=0.9,*/*;q=0.8',
      },
    });

    const finalUrl = response.url || targetUrl;
    let finalHost = parsed.hostname;
    try {
      finalHost = new URL(finalUrl).hostname;
    } catch {
      // keep initial hostname
    }
    const resolvedDomain = extractRootDomain(finalHost);
    const domainMatched = isDomainMatch(finalHost, targetExpected);
    const httpStatus = response.status;

    let pageTitle = '';
    const contentType = response.headers?.get?.('content-type') || '';
    if (contentType.includes('text/html') && response.body) {
      try {
        const text = (await response.text()).slice(0, 65536);
        pageTitle = extractHtmlTitle(text);
      } catch {
        // ignore body read issues
      }
    }

    if (httpStatus >= 200 && httpStatus < 400) {
      if (!domainMatched) {
        return {
          ok: false,
          targetUrl,
          finalUrl,
          httpStatus,
          resolvedDomain,
          expectedDomain: targetExpected,
          isDomainMatch: false,
          resultStatus: 'domain_mismatch',
          pageTitle,
          message: `页面跳转到了非预设官方域名 (${finalHost})，建议核对后再投递。`,
          checkedAt,
        };
      }

      const redirected = finalUrl !== targetUrl;
      return {
        ok: true,
        targetUrl,
        finalUrl,
        httpStatus,
        resolvedDomain,
        expectedDomain: targetExpected,
        isDomainMatch: true,
        resultStatus: redirected ? 'redirect_verified' : 'reachable',
        pageTitle,
        message: pageTitle
          ? `官网可达并匹配域名 ${targetExpected}（页面标题：${pageTitle}）`
          : `官网链接可达（HTTP ${httpStatus}），落地域名与 ${targetExpected} 一致。`,
        checkedAt,
      };
    }

    if (httpStatus === 401 || httpStatus === 403 || httpStatus === 418 || httpStatus === 429) {
      return {
        ok: true,
        targetUrl,
        finalUrl,
        httpStatus,
        resolvedDomain,
        expectedDomain: targetExpected,
        isDomainMatch: domainMatched,
        resultStatus: 'restricted_portal',
        pageTitle,
        message: `官网开启了访问防护或登录门禁 (HTTP ${httpStatus})，系统不绕过校验，请点击「直达官网」在浏览器中正常投递。`,
        checkedAt,
      };
    }

    return {
      ok: false,
      targetUrl,
      finalUrl,
      httpStatus,
      resolvedDomain,
      expectedDomain: targetExpected,
      isDomainMatch: domainMatched,
      resultStatus: 'unreachable',
      pageTitle,
      message: `官网返回异常状态码 HTTP ${httpStatus}，可能岗位入口已调整或暂不可访问。`,
      checkedAt,
    };
  } catch (err) {
    const isAbort = err?.name === 'AbortError';
    return {
      ok: false,
      targetUrl,
      finalUrl: '',
      httpStatus: null,
      resolvedDomain: extractRootDomain(parsed.hostname),
      expectedDomain: targetExpected,
      isDomainMatch: false,
      resultStatus: 'unreachable',
      pageTitle: '',
      message: isAbort
        ? '官网响应超时（>6秒），可能处于校园网/外网波动或高并发网申时段。'
        : `连接官网失败（${err?.message || '网络不可达'}），可直接点击官方入口尝试在浏览器中打开。`,
      checkedAt,
    };
  } finally {
    clearTimeout(timer);
  }
}
