class AuthorsListPage extends HTMLElement {
  constructor() {
    super();
  }

  connectedCallback() {
    this.render();
  }

  render() {
    const authors = this.getTemporaryAuthors();
    this.innerHTML = `
      <h1 class="text-3xl font-bold mb-6">Authors</h1>
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        ${this.generateAuthorList(authors)}
      </div>
    `;
  }

  getTemporaryAuthors() {
    return [
      { id: 1, name: "Alice Johnson", avatar: "https://i.pravatar.cc/800?img=1", bio: "Tech enthusiast and AI specialist" },
      { id: 2, name: "Bob Smith", avatar: "https://i.pravatar.cc/150?img=2", bio: "Frontend developer with a passion for UX" },
      { id: 3, name: "Charlie Brown", avatar: "https://i.pravatar.cc/150?img=3", bio: "Backend guru and database expert" },
      { id: 4, name: "Diana Prince", avatar: "https://i.pravatar.cc/150?img=4", bio: "Full-stack developer and open-source contributor" },
      { id: 5, name: "Ethan Hunt", avatar: "https://i.pravatar.cc/150?img=5", bio: "Mobile app developer and UI designer" },
      { id: 6, name: "Fiona Gallagher", avatar: "https://i.pravatar.cc/150?img=6", bio: "DevOps engineer and cloud computing expert" }
    ];
  }

  generateAuthorList(authors) {
    return authors.map((author,index) => `
      <div class="text-center">
        <a href="/author/${author.id}" data-link class="block group">
          <img 
            class="w-32 h-32 mx-auto mb-4 transition-transform duration-200 transform group-hover:scale-105" 
            src="${author.avatar}" 
            alt="${author.name}" 
            data-animate="author-${author.id}-image,fade,300,`+100 * index +`,fade,300">
          
          <p 
            class="text-xl font-semibold group-hover:text-blue-600 transition-colors duration-200" 
            data-animate="author-${author.id}-name,slide-up,300,0,fade,300">
            ${author.name}
          </p>
        </a>
      </div>
    `).join('');
  }
}

customElements.define('authors-list-page', AuthorsListPage);