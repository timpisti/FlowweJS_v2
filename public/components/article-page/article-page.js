class ArticlePage extends HTMLElement {
  constructor() {
    super();
    this.articleId = null;
  }

  connectedCallback() {
    this.articleId = this.getAttribute('id');
    this.render();
  }

  async render() {
    const article = await this.getArticle(this.articleId);
    if (!article) {
      this.innerHTML = '<h1>Article not found</h1>';
      return;
    }

    this.innerHTML = `
      <article class="max-w-3xl mx-auto">
	  <div>
	  <div class="text-4xl font-bold"><H2
              text-type="h1" 
              class="text-4xl font-bold mb-4" 
			  data-animate="article-${article.id}-text,scale,300,0,fade,300"
              >
              ${article.title}
            </h2>
			</div>
			<div style="height:700px;">
          <img
            class="w-full object-cover mb-6 rounded-lg" 
            src="${article.image}" 
            alt="${article.title}" 
			data-animate="article-${article.id}-image,fade,300,0,fade,300"
            >
          
			</div>
		</div>
          <div class="flex items-center mt-2">
            <a href="/author/${article.author.id}" data-link class="flex items-center hover:text-blue-600 transition-colors duration-200">
              <div class="w-10 h-10 rounded-full overflow-hidden mr-4">
                <img data-animate="author-${article.author.id}-image,scale,3000,0,fade,300"
                  class="w-full h-full object-cover" 
                  src="${article.author.avatar}" 
                  alt="${article.author.name}" 
                  >
                </common-image>
              </div>
              <p data-animate="author-${article.author.id}-name,scale,3000,0,fade,300"
                class="text-gray-700" 
                >
                ${article.author.name}
              </p>
            </a>
          </div>
		  
        <div class="text-gray-800 leading-relaxed" data-animate="article-${article.id}-content,fade,500,0,fade,300">
          ${article.content}
        </div>
      </article>
    `;
  }

  async getArticle(id) {
    // In a real application, this would be an API call
    // For now, we'll use a mock
    const articles = {
      '1': {
        id: 1,
        title: "The Future of AI in Web Development",
        image: "https://picsum.photos/seed/ai1/800/600",
        author: {
          id: 1,
          name: "Alice Johnson",
          avatar: "https://i.pravatar.cc/150?img=1"
        },
        content: "Artificial Intelligence is revolutionizing the way we approach web development..."
      },
      // Add more mock articles as needed
    };
    return articles[id];
  }
}

customElements.define('article-page', ArticlePage);