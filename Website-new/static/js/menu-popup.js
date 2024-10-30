// This function adds the CSS link to the head of the document
function addCSSLink() {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/css/menu-popup.css';
    document.head.appendChild(link);
}

// This function initializes the floating menu
function initFloatingMenu() {
    addCSSLink();  // Automatically add the CSS link

    const menuBtn = document.createElement('div');
    const overlay = document.createElement('div');
    const menuContent = document.createElement('div');
    const closeBtn = document.createElement('button');

    // Set menu button properties
    menuBtn.id = 'menu-btn';
    menuBtn.classList.add('menu-btn');
    menuBtn.textContent = 'Menu';

    // Set overlay properties
    overlay.id = 'overlay';
    overlay.classList.add('overlay');

    // Set menu content properties
    menuContent.id = 'menu-content';
    menuContent.classList.add('menu-content');
    menuContent.innerHTML = `
        <h2>Live Server Update</h2>
        <p>Live server information and updates will be displayed here.</p>
    `;
    
    // Set close button properties
    closeBtn.id = 'close-btn';
    closeBtn.classList.add('close-btn');
    closeBtn.textContent = 'Close';
    menuContent.appendChild(closeBtn);

    // Append elements to the body
    document.body.appendChild(menuBtn);
    document.body.appendChild(overlay);
    document.body.appendChild(menuContent);

    // Show the menu content and darken the background when the menu button is clicked
    menuBtn.addEventListener('click', () => {
        overlay.style.display = 'block';
        menuContent.style.display = 'block';
    });

    // Close the menu content and remove the dark background when the close button is clicked
    closeBtn.addEventListener('click', () => {
        overlay.style.display = 'none';
        menuContent.style.display = 'none';
    });

    // Also close the menu when clicking outside the content (on the overlay)
    overlay.addEventListener('click', () => {
        overlay.style.display = 'none';
        menuContent.style.display = 'none';
    });
}

// Load the floating menu on window load
window.addEventListener('load', initFloatingMenu);
