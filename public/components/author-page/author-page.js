class AuthorPage extends HTMLElement {
  constructor() {
    super();
    this.authorId = null;
  }

  connectedCallback() {
    if (this.authorId) {
      this.render();
    }
  }

  async update(params) {
    this.authorId = params.id;
    await this.render();
  }

  async render() {
    const author = await this.getAuthor(this.authorId);
    if (!author) {
      this.innerHTML = '<h1>Author not found</h1>';
      return;
    }

    const esc = window.escapeHtml || (s => String(s));

    this.innerHTML = `
      <div class="max-w-3xl mx-auto">
        <div class="text-center mb-8">
		<div>
          <img id="authorimage${author.id}" data-animate="author-${author.id}-image,scale,300,0,fade,300"
            class="mx-auto mb-4"
            src="${author.avatar}"
            alt="${esc(author.name)}"
            data-image-type="avatar">
		 </div>
          <p id="authorname${author.id}" data-animate="author-${author.id}-name,scale,3000,0,fade,300" class="text-gray-700">
                ${esc(author.name)}
              </p>
          <p
            class="text-gray-600 mb-4"

            data-author-id="${author.id}"
            data-text-type="bio">
            ${esc(author.bio)}
          </p>
        </div>
        <h2 class="text-2xl font-bold mb-4">Articles by ${esc(author.name)}</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          ${this.generateArticleList(author.articles)}
        </div>
      </div>
    `;
  }

  async getAuthor(id) {
    // In a real application, this would be an API call
    // For now, we'll use a mock
    const authors = {
      '1': { id: 1, name: "Alice Johnson", avatar: "https://i.pravatar.cc/800?img=1", bio: "Tech enthusiast and AI specialist", articles: [
        { id: 1, title: "The Future of AI in Web Development", image: "https://picsum.photos/seed/ai1/800/600" },
        { id: 2, title: "Machine Learning Basics", image: "https://picsum.photos/seed/ml1/800/600" }
      ]},
      // ... add more authors
    };
    return authors[id];
  }

  generateArticleList(articles) {
    const esc = window.escapeHtml || (s => String(s));
    return articles.map((article,index) => `
      <div class="bg-white shadow-md rounded-lg overflow-hidden">

	   <a href="/articles/${article.id}" data-link class="block">
          <img id="articleimage${article.id}" class="w-full h-48 object-cover"
            src="${article.image}"
            alt="${esc(article.title)}"
			data-animate="article-${article.id}-image,fade,300,` + 100*index +`,fade,300">

          <div class="p-4">
			  <h2 id="articletitle${article.id}" class="text-xl font-semibold hover:text-blue-600 transition-colors duration-200"
			  data-animate="article-${article.id}-text,fade,300,` + 100*index +`,fade,300">
              ${esc(article.title)}
            </h2>
          </div>
        </a>
      </div>
    `).join('');
  }
}

customElements.define('author-page', AuthorPage);
