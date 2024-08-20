class ArticleListPage extends HTMLElement {
  constructor() {
    super();
  }

  connectedCallback() {
    this.render();
  }

  render() {
    const articles = this.getTemporaryArticles();
    this.innerHTML = `
      <h1 class="dark:text-gray-50 text-gray-900 bg-gray-50 dark:bg-gray-900 text-3xl font-bold mb-6">Articles</h1>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        ${this.generateArticleList(articles)}
      </div>
    `;
  }

  getTemporaryArticles() {
    return [
      {
        id: 1,
        title: "The Future of AI in Web Development",
        image: "https://picsum.photos/seed/ai1/800/600",
        author: {
          id: 1,
          name: "Alice Johnson",
          avatar: "https://i.pravatar.cc/150?img=1"
        }
      },
      {
        id: 2,
        title: "10 Tips for Responsive Design",
        image: "https://picsum.photos/seed/responsive2/800/600",
        author: {
          id: 2,
          name: "Bob Smith",
          avatar: "https://i.pravatar.cc/150?img=2"
        }
      },
      {
        id: 3,
        title: "Understanding JavaScript Promises",
        image: "https://picsum.photos/seed/js3/800/600",
        author: {
          id: 3,
          name: "Charlie Brown",
          avatar: "https://i.pravatar.cc/150?img=3"
        }
      },
      {
        id: 4,
        title: "The Rise of Progressive Web Apps",
        image: "https://picsum.photos/seed/pwa4/800/600",
        author: {
          id: 4,
          name: "Diana Prince",
          avatar: "https://i.pravatar.cc/150?img=4"
        }
      },
      {
        id: 5,
        title: "CSS Grid vs Flexbox: When to Use Which?",
        image: "https://picsum.photos/seed/css5/800/600",
        author: {
          id: 5,
          name: "Ethan Hunt",
          avatar: "https://i.pravatar.cc/150?img=5"
        }
      },
      {
        id: 6,
        title: "Optimizing Web Performance: A Deep Dive",
        image: "https://picsum.photos/seed/perf6/800/600",
        author: {
          id: 6,
          name: "Fiona Gallagher",
          avatar: "https://i.pravatar.cc/150?img=6"
        }
      }
    ];
  }

generateArticleList(articles) {
    return articles.map((article, index) => `
      <div class="bg-white dark:bg-gray-900 shadow-md rounded-lg overflow-hidden flex flex-col">
        <a href="/articles/${article.id}" data-link class="relative w-full h-48 block">
          <img class="w-full h-full object-cover" src="${article.image}" id="articleimage${article.id}" alt="${article.title}" data-animate="article-${article.id}-image,fade,300,` + 100*index +`,fade,300">
        </a>
        <div class="p-4 flex-grow">
          <a href="/articles/${article.id}" data-link class="block mb-2">
            <h2 id="articletitle${article.id}" class="text-xl text-gray-900 dark:text-gray-50 font-semibold hover:text-blue-600 transition-colors duration-200" 
			  data-animate="article-${article.id}-text,fade,300,` + 100*index +`,fade,300">
              ${article.title}  
            </h2>
          </a>
          <div class="flex items-center mt-2">
            <a href="/author/${article.author.id}" data-link class="flex items-center hover:text-blue-600 transition-colors duration-200">
              <div class="w-10 h-10 rounded-full overflow-hidden mr-4">
                <img id="authorimage${article.author.id}" data-animate="author-${article.author.id}-image,scale,300,` + 100*index +`,fade,300"
                  class="w-full h-full object-cover" 
                  src="${article.author.avatar}" 
                  alt="${article.author.name}" 
                  >
               
              </div>
              <p id="authorname${article.author.id}" data-animate="author-${article.author.id}-name,scale,300,` + 100*index +`,fade,300" >
                ${article.author.name}
              </p>
            </a>
          </div>
        </div>
      </div>
    `).join('');
  }
}

customElements.define('article-list-page', ArticleListPage);