export default function ObservationsPanel({ items = [] }) {
  return (
    <section className="panel research-observations">
      <div className="panel-head">
        <h3>Research Observations</h3>
        <span>Plain-language interpretation of the dataset</span>
      </div>

      <div className="observations-list">
        {items.map((item, index) => (
          <article key={`${item}-${index}`} className="observation-item">
            <p>{item}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
