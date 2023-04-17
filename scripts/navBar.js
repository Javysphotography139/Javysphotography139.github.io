function myFunction() {
    const x = document.getElementById("myTopnav");
    if (x.className === "topnav") {
        x.className += " responsive";
        x.style.position = "fixed"
    } else {
        x.className = "topnav";
    }
}
window.addEventListener('scroll', function (evt) {
    const nav = document.getElementById("myTopnav");
    if (window.pageYOffset >= (window.innerHeight - 200)) {
        nav.style.backgroundColor = "#1F75FE";
        nav.style.visibility = "visible"
        nav.style.opacity = 1;
        nav.style.transition = "visibility 0.5s, opacity 0.5s linear";
    } else {
        nav.style.visibility = "hidden";
        nav.style.opacity = 0;
        nav.style.transition = "visibility 0.5s, opacity 0.5s linear";
    }
});

function onAboutClick() {
    closeMobileNav();
}

function onPortfolioClick() {
    closeMobileNav();
}

function onTitleClick() {
    closeMobileNav();
}

function onContactClick() {
    closeMobileNav();
}

function closeMobileNav() {
    const ul = document.getElementsByClassName('topnav')[0];
    ul.className = "topnav";
}

function openModel(img) {
    const modal = document.getElementById('myModal');
    modal.style.display = "block";
    const modalImg = document.getElementById("img01");
    modalImg.src = img.src;
    modalImg.alt = img.alt;
}
function closeModel(img) {
    const modal = document.getElementById('myModal');
    modal.style.display = "none";
}