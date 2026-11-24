// www.lun222.com を lun222.com へ転送する
export default {
  fetch(request) {
    const url = new URL(request.url)
    url.protocol = 'https:'
    url.hostname = 'lun222.com'
    return Response.redirect(url.href, 301)
  },
}
